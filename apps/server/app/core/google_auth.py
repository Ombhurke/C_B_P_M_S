import hashlib
import time
from uuid import UUID
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException

from app.core.config import settings
from app.core.database import db

_VERIFIED_TOKEN_CACHE: dict[str, tuple[dict, float]] = {}


def fetch_supabase_user(token: str) -> dict:
    base = (settings.SUPABASE_URL or "").rstrip("/")
    if urlparse(base).scheme != "https" or not settings.SUPABASE_PUBLISHABLE_KEY:
        raise HTTPException(503, "Customer authentication is not configured")
    try:
        response = httpx.get(base + "/auth/v1/user", headers={
            "apikey": settings.SUPABASE_PUBLISHABLE_KEY,
            "Authorization": "Bearer " + token,
        }, timeout=10, follow_redirects=False)
        if response.status_code in (401, 403):
            raise HTTPException(401, "Sign in with Google again")
        if response.status_code != 200:
            raise HTTPException(503, "Authentication service is unavailable")
        return response.json()
    except (httpx.HTTPError, ValueError):
        raise HTTPException(503, "Authentication service is unavailable") from None


def resolve_google_user(token: str) -> dict:
    now = time.time()
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    if settings.ENVIRONMENT != "test":
        cached = _VERIFIED_TOKEN_CACHE.get(token_hash)
        if cached and cached[1] > now:
            return cached[0]

    identity = fetch_supabase_user(token)
    try:
        user_id = str(UUID(identity["id"]))
        email = identity["email"]
        providers = identity.get("app_metadata", {}).get("providers", [])
        supported_providers = {"google", "email"}
        if (not identity.get("email_confirmed_at") or not isinstance(email, str)
                or not email or not any(p in supported_providers for p in providers)):
            raise ValueError("Not a verified customer account")
    except (KeyError, TypeError, ValueError, AttributeError):
        raise HTTPException(401, "A verified customer account is required") from None
    key = "supabase:" + user_id
    with db.transaction() as records:
        existing = records.get("users", key)
        if existing and not existing.get("active", True):
            raise HTTPException(403, "Account disabled")
        # Do not link legacy accounts by email, or trust user_metadata for roles.
        existing_alias = existing.get("alias") if existing else None
        meta_alias = identity.get("user_metadata", {}).get("alias") if isinstance(identity.get("user_metadata"), dict) else None
        default_alias = email[:6] if len(email) >= 6 else email
        alias = existing_alias or meta_alias or default_alias
        alias_chosen = bool(existing.get("alias_chosen") if existing and "alias_chosen" in existing else (meta_alias is not None))

        user = {"id": user_id, "username": email, "alias": alias, "alias_chosen": alias_chosen,
                "role": "customer", "shop_id": None, "active": True,
                "created_at": existing.get("created_at") if existing else now}
        if existing != user:
            records.put("users", key, user)

    res = {**user, "identity_key": key}
    if len(_VERIFIED_TOKEN_CACHE) > 500:
        _VERIFIED_TOKEN_CACHE.clear()
    _VERIFIED_TOKEN_CACHE[token_hash] = (res, now + 30.0)
    return res


def update_cached_user_alias(user_id: str, new_alias: str):
    for token_hash, (cached_user, exp) in list(_VERIFIED_TOKEN_CACHE.items()):
        if cached_user.get("id") == user_id:
            cached_user["alias"] = new_alias
            cached_user["alias_chosen"] = True
            _VERIFIED_TOKEN_CACHE[token_hash] = (cached_user, exp)


