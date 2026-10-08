"""Password hashes and revocable, hashed opaque sessions scoped to one shop."""
import hashlib
import hmac
import secrets
import time

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.database import db

bearer = HTTPBearer(auto_error=False)


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 600_000).hex()
    return f"{salt}${key}"


def password_matches(password, stored):
    return hmac.compare_digest(password_hash(password, stored.split("$")[0]), stored)


def resolve_session(token):
    if not isinstance(token, str) or len(token) > 16384:
        raise HTTPException(401, "Invalid session")
    if token.count(".") == 2:
        from app.core.google_auth import resolve_google_user
        return resolve_google_user(token)
    with db.transaction(readonly=True) as records:
        session = records.get("sessions", digest(token))
        if not session or session["expires_at"] <= time.time():
            raise HTTPException(401, "Session expired or invalid")
        user = records.get("users", session["username"])
        if not user or not user.get("active", True) or user.get("role") not in ("admin", "operator"):
            raise HTTPException(401, "Account disabled")
        return {"username": user["username"], "shop_id": user.get("shop_id"),
                "role": user["role"], "session_id": digest(token)}


def current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    if not credentials:
        raise HTTPException(401, "Login required")
    return resolve_session(credentials.credentials)


def optional_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    """Resolve a bearer session when present, without making anonymous access public by accident."""
    return resolve_session(credentials.credentials) if credentials else None


def require_shop(user, shop_id, admin=False):
    if (not shop_id or user.get("role") not in ("admin", "operator")
            or user.get("shop_id") != shop_id or (admin and user["role"] != "admin")):
        raise HTTPException(403, "No permission for this shop or operation")


def failed_attempt(key, limit=3):
    with db.transaction() as records:
        attempt = records.get("attempts", key) or {"count": 0, "until": 0}
        if attempt["until"] and attempt["until"] <= time.time():
            attempt = {"count": 0, "until": 0}
        attempt["count"] += 1
        if attempt["count"] >= limit:
            attempt["until"] = time.time() + 300
        records.put("attempts", key, attempt)
        return attempt["until"] > time.time()


def check_attempts(key):
    with db.transaction() as records:
        attempt = records.get("attempts", key)
    if attempt and attempt["until"] > time.time():
        raise HTTPException(429, "Too many attempts; locked for up to 300 seconds")
