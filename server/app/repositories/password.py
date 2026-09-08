"""Password hashing and verification helpers."""

import hashlib
import hmac
import os
import sys

# Production target: 600k (OWASP 2023 for PBKDF2-SHA256). Test/dev use 100k
# to keep pytest fast — detected via pytest in sys.modules or APP_ENV != production.
if "pytest" in sys.modules or os.getenv("APP_ENV", "development") != "production":
    ITERATIONS = 100_000
    _PROD_ITERATIONS = 600_000
else:
    ITERATIONS = 600_000
    _PROD_ITERATIONS = 600_000


def _parse_stored_salt(stored_salt: str) -> tuple[str, int]:
    """Support both legacy 'hex' and new 'hex$iterations' formats."""
    if "$" in stored_salt:
        salt_hex, iter_str = stored_salt.rsplit("$", 1)
        try:
            return salt_hex, int(iter_str)
        except ValueError:
            return stored_salt, ITERATIONS
    return stored_salt, ITERATIONS


def hash_password(password: str, salt: str | None = None, iterations: int | None = None) -> tuple[str, str]:
    iters = iterations or ITERATIONS
    if salt is None:
        salt_bytes = os.urandom(16)
        salt_hex = salt_bytes.hex()
        stored_salt = f"{salt_hex}${iters}" if iters != 100_000 else salt_hex
    else:
        # If caller passes legacy hex without iterations marker, preserve legacy form but use correct iters
        salt_hex, _ = _parse_stored_salt(salt)
        salt_bytes = bytes.fromhex(salt_hex)
        # Preserve new format for newly hashed passwords
        stored_salt = f"{salt_hex}${iters}" if iters != 100_000 or "$" in salt else salt_hex

    pwd_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt_bytes,
        iters,
    ).hex()
    return pwd_hash, stored_salt


def verify_password(password: str, stored_hash: str, stored_salt: str) -> bool:
    _salt_hex, iters = _parse_stored_salt(stored_salt)
    pwd_hash, _ = hash_password(password, _salt_hex, iterations=iters)
    return hmac.compare_digest(pwd_hash, stored_hash)


def needs_rehash(stored_salt: str) -> bool:
    """True if stored hash was created with old iteration count."""
    _, iters = _parse_stored_salt(stored_salt)
    return iters < _PROD_ITERATIONS

