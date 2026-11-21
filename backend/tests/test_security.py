from contextlib import nullcontext

from app import db as store
import pytest
from fastapi import HTTPException
from jose import jwt

from app.config import JWT_ALGORITHM, JWT_SECRET
from app.security import create_access_token, get_current_user, hash_password, verify_password


def test_hash_password_differs_from_plain():
    hashed = hash_password("secret123")
    assert hashed != "secret123"


def test_verify_password_roundtrip():
    hashed = hash_password("secret123")
    assert verify_password("secret123", hashed)
    assert not verify_password("wrong-password", hashed)


def test_create_access_token_contains_subject_and_expiry():
    token = create_access_token("user@example.com")
    payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    assert payload["sub"] == "user@example.com"
    assert "exp" in payload


def test_get_current_user_rejects_malformed_token():
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(token="not-a-valid-jwt", db=None)
    assert exc_info.value.status_code == 401


def test_get_current_user_rejects_token_without_subject():
    token = jwt.encode({"exp": 9999999999}, JWT_SECRET, algorithm=JWT_ALGORITHM)
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(token=token, db=None)
    assert exc_info.value.status_code == 401


def test_get_current_user_rejects_unknown_subject(db):
    
    token = create_access_token("ghost@example.com")
    with nullcontext(db) as session:
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(token=token, db=session)
    assert exc_info.value.status_code == 401
