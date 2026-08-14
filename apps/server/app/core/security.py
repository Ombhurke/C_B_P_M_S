import secrets
import hashlib
import time
from typing import Dict, Tuple
from app.core.config import settings


class RateLimiter:
    """In-memory rate limiter for 4-digit token validation attempts per shop."""
    def __init__(self):
        # Key: (shop_id, ip_or_client) -> (attempt_count, locked_until_timestamp)
        self._attempts: Dict[str, Tuple[int, float]] = {}

    def is_locked(self, key: str) -> Tuple[bool, int]:
        now = time.time()
        if key in self._attempts:
            count, locked_until = self._attempts[key]
            if locked_until > now:
                remaining = int(locked_until - now)
                return True, remaining
            elif locked_until > 0 and locked_until <= now:
                # Lockout expired, reset
                del self._attempts[key]
        return False, 0

    def record_failed_attempt(self, key: str) -> Tuple[int, bool, int]:
        now = time.time()
        count, locked_until = self._attempts.get(key, (0, 0.0))
        count += 1
        
        if count >= settings.MAX_TOKEN_ATTEMPTS:
            locked_until = now + settings.LOCKOUT_DURATION_SECONDS
            self._attempts[key] = (count, locked_until)
            return count, True, settings.LOCKOUT_DURATION_SECONDS
        
        self._attempts[key] = (count, 0.0)
        return count, False, 0

    def reset(self, key: str):
        if key in self._attempts:
            del self._attempts[key]


rate_limiter = RateLimiter()


def generate_release_token() -> str:
    """Generates a secure 4-digit numeric code."""
    return f"{secrets.randbelow(10000):04d}"


def hash_content(data: bytes) -> str:
    """Generates SHA-256 hash for document integrity verification."""
    return hashlib.sha256(data).hexdigest()
