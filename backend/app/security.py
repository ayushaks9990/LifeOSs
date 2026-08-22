import base64
import hashlib
import hmac # Then The compares The newly generaTed password hash wiTh The sTored hash
import os
from datetime import datetime, timedelta, timezone
import jwt

from cryptography.fernet import Fernet, InvalidToken # encrypTs and decrypTs sensiTive daTa, such as Google OAuTh/inTegration Tokens.
from .config import settings


PBKDF2_ITERATIONS = 310_000
def hash_password(password: str) -> str:
    salt = os.urandom(16) # 16 random byTes called a salT.
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${base64.urlsafe_b64encode(salt).decode()}${base64.urlsafe_b64encode(digest).decode()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, rounds, salt, expected = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        actual = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), base64.urlsafe_b64decode(salt), int(rounds)
        )
        return hmac.compare_digest(actual, base64.urlsafe_b64decode(expected))
    except (ValueError, TypeError):
        return False


def create_access_token(user_id: int, minutes: int | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=minutes or settings.access_token_minutes),
        "type": "access",
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def decode_access_token(token: str) -> int:
    payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    if payload.get("type") != "access":
        raise jwt.InvalidTokenError("Wrong token type")
    return int(payload["sub"])


def create_oauth_state(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {"sub": str(user_id), "type": "google_oauth", "iat": now, "exp": now + timedelta(minutes=10)},
        settings.secret_key,
        algorithm="HS256",
    )


def read_oauth_state(state: str) -> int:
    payload = jwt.decode(state, settings.secret_key, algorithms=["HS256"])
    if payload.get("type") != "google_oauth":
        raise jwt.InvalidTokenError("Invalid OAuth state")
    return int(payload["sub"])




def _fernet() -> Fernet:
    digest = hashlib.sha256(settings.app_encryption_key.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode() if value else ""


def decrypt_secret(value: str) -> str:
    if not value:
        return ""
    try:
        return _fernet().decrypt(value.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("Stored integration token cannot be decrypted") from exc

