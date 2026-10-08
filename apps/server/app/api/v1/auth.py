import secrets
import time
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.auth import (check_attempts, current_user, digest, failed_attempt,
                           password_hash, password_matches)
from app.core.config import settings
from app.core.database import db
from app.core.audit import record_audit
from app.services.storage_service import storage_service

router = APIRouter(prefix="/auth", tags=["Authentication"])
# Equal-cost verification for unknown accounts.
DUMMY_HASH = password_hash(secrets.token_urlsafe(32))


class Login(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=256)


class NewUser(Login):
    password: str = Field(min_length=12, max_length=256)
    role: Literal["admin", "operator"] = "operator"


def normalize_username(value: str) -> str:
    return value.strip().lower()


def session_response(token, expires, user):
    return {"access_token": token, "token_type": "bearer", "expires_at": expires,
            "user": {"username": user["username"], "shop_id": user.get("shop_id"),
                      "role": user["role"]}}


@router.post("/login")
def login(payload: Login, request: Request):
    username = normalize_username(payload.username)
    key = "login:" + digest(request.client.host if request.client else "local")
    check_attempts(key)
    with db.transaction() as records:
        user = records.get("users", username)
    valid = password_matches(payload.password, user.get("password_hash", DUMMY_HASH) if user else DUMMY_HASH)
    if not valid or not user or not user.get("active", True) or user.get("role") not in ("admin", "operator"):
        locked = failed_attempt(key, limit=5)
        raise HTTPException(429 if locked else 401, "Invalid credentials or login temporarily locked")
    token = secrets.token_urlsafe(32)
    expires = time.time() + settings.AUTH_SESSION_SECONDS
    with db.transaction() as records:
        records.remove("attempts", key)
        records.put("sessions", digest(token), {"id": digest(token), "username": user["username"], "expires_at": expires})
        record_audit(records, "auth.login", actor=user["username"])
    return session_response(token, expires, user)


@router.get("/me")
def me(user=Depends(current_user)):
    return {k: user.get(k) for k in ("id", "username", "shop_id", "role", "alias", "alias_chosen")}


@router.post("/logout")
def logout(user=Depends(current_user)):
    if user["role"] == "customer":
        raise HTTPException(400, "Use the customer sign-out endpoint")
    with db.transaction() as records:
        records.remove("sessions", user["session_id"])
        record_audit(records, "auth.logout", actor=user["username"],
                     metadata={"shop_id": user.get("shop_id")} if user.get("shop_id") else {})
    return {"ok": True}


@router.post("/users", status_code=201)
def create_user(payload: NewUser, user=Depends(current_user)):
    if user["role"] != "admin":
        raise HTTPException(403, "Administrator required")
    username = normalize_username(payload.username)
    if username.startswith("supabase:"):
        raise HTTPException(422, "Reserved username")
    encoded = password_hash(payload.password)
    with db.transaction() as records:
        if records.get("users", username):
            raise HTTPException(409, "Username already exists")
        records.put("users", username, {"username": username,
            "password_hash": encoded, "shop_id": user["shop_id"], "role": payload.role, "active": True})
    return {"username": username, "shop_id": user["shop_id"], "role": payload.role}


@router.delete("/me")
def delete_customer_account(user=Depends(current_user)):
    if user["role"] != "customer":
        raise HTTPException(403, "Only customer accounts can be deleted here")
    with db.transaction() as records:
        owned_jobs = [j for j in records.list("jobs") if j.get("owner_id") == user["id"]]
        active = [j for j in owned_jobs if j.get("job_status") in ("staged", "queued", "processing")]
        if active:
            raise HTTPException(409, "Finish or cancel active print jobs before deleting the account")
        owned_documents = [d for d in records.list("documents") if d.get("owner_id") == user["id"]]
        for document in owned_documents:
            if not storage_service.purge(document):
                raise HTTPException(503, "Document deletion is pending; account was not removed")
        for job in owned_jobs:
            job["owner_id"] = None
            job["access_mode"] = "anonymous"
            job["document_id"] = None
            records.put("jobs", job["id"], job)
        for document in owned_documents:
            records.remove("documents", document["id"])
        # OAuth customers have no local staff sessions. Never revoke staff by email match.
        # Keep a non-PII tombstone so a still-valid OAuth token cannot re-create the account.
        records.put("users", user["identity_key"], {"id": user["id"], "active": False})
        record_audit(records, "customer.delete", actor=user["id"])
    return {"deleted": True, "scope": "CBPMS data; upstream Google/Supabase identity is not deleted"}
