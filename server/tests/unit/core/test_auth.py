"""Unit tests for core.auth — token creation/validation primitives."""

import pytest
from fastapi import HTTPException

from app.core.auth import (
    create_serializer,
    create_user_token,
    get_current_user,
    get_current_user_from_token,
    try_get_user_from_token,
)
from tests.support.auth import TEST_USER


def make_token(**overrides) -> str:
    payload = {**TEST_USER, **overrides}
    return create_user_token(payload)


class TestCreateUserToken:
    def test_token_contains_uid_email_name(self):
        data = get_current_user_from_token(make_token())
        assert data["uid"] == TEST_USER["uid"]
        assert data["email"] == TEST_USER["email"]
        assert data["name"] == TEST_USER["name"]

    def test_display_name_fallback_to_name_field(self):
        token = create_user_token({"uid": "u1", "display_name": "Display"})
        assert get_current_user_from_token(token)["name"] == "Display"

    def test_tokens_are_signed_and_distinct_payloads_differ(self):
        t1 = make_token()
        t2 = make_token(uid="someone-else")
        assert t1 != t2


class TestTokenValidation:
    def test_valid_token_passes(self):
        assert get_current_user_from_token(make_token())["uid"] == TEST_USER["uid"]

    def test_tampered_token_rejected(self):
        token = make_token()
        tampered = token[:-4] + "aaaa"
        with pytest.raises(HTTPException) as exc_info:
            get_current_user_from_token(tampered)
        assert exc_info.value.status_code == 401

    def test_wrong_salt_serializer_produces_invalid_token(self):
        other = create_serializer("different-salt").dumps({"uid": "user-1"})
        with pytest.raises(HTTPException):
            get_current_user_from_token(other)

    def test_missing_uid_rejected(self):
        rogue = create_serializer("starwaves-auth-token").dumps({"email": "x@y.z"})
        assert try_get_user_from_token(rogue) is None

    def test_try_variant_returns_none_for_garbage(self):
        assert try_get_user_from_token("garbage-token") is None

    def test_try_variant_returns_payload_for_valid(self):
        assert try_get_user_from_token(make_token())["uid"] == TEST_USER["uid"]


class TestGetCurrentUserDependency:
    def test_missing_header_raises_401(self):
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(authorization=None)
        assert exc_info.value.status_code == 401
        assert "required" in exc_info.value.detail.lower()

    def test_non_bearer_scheme_raises_401(self):
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(authorization="Basic abc123")
        assert exc_info.value.status_code == 401

    def test_bearer_with_garbage_token_raises_401(self):
        with pytest.raises(HTTPException):
            get_current_user(authorization="Bearer garbage")

    def test_bearer_with_valid_token_returns_user(self):
        user = get_current_user(authorization=f"Bearer {make_token()}")
        assert user["uid"] == TEST_USER["uid"]
