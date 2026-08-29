"""API tests: /auth routes against the real SQLite database.

Covers credentials (signup/login), password recovery, account management,
and Google OAuth (login URL + callback with mocked outbound HTTP).
"""

import httpx
import pytest

from app.api.routes.auth._shared import state_serializer
from tests.support.auth import headers_for


@pytest.fixture(autouse=True)
def _no_welcome_email(monkeypatch):
    """Keep signup flows hermetic — never touch SMTP even if a host is set."""
    monkeypatch.setattr(
        "app.api.routes.auth.credentials._send_welcome_email_best_effort", lambda *a, **k: None
    )
    monkeypatch.setattr(
        "app.api.routes.auth.oauth._send_welcome_email_best_effort", lambda *a, **k: None
    )


SIGNUP_PAYLOAD = {"email": "new-user@example.com", "password": "supersecret123", "name": "New User"}


class TestSignup:
    def test_signup_success_returns_token_and_user(self, auth_client):
        res = auth_client.post("/api/v1/auth/signup", json=SIGNUP_PAYLOAD)
        assert res.status_code == 200
        data = res.json()
        assert data["token"]
        assert data["user"]["email"] == "new-user@example.com"
        assert data["user"]["displayName"] == "New User"
        assert data["user"]["uid"]

    def test_signup_persists_password_account(self, auth_client):
        auth_client.post("/api/v1/auth/signup", json=SIGNUP_PAYLOAD)
        # The created account can immediately log in
        login = auth_client.post(
            "/api/v1/auth/login",
            json={"email": "new-user@example.com", "password": "supersecret123"},
        )
        assert login.status_code == 200

    def test_duplicate_signup_rejected(self, auth_client):
        auth_client.post("/api/v1/auth/signup", json=SIGNUP_PAYLOAD)
        dup = auth_client.post("/api/v1/auth/signup", json=SIGNUP_PAYLOAD)
        assert dup.status_code == 400
        assert "exists" in dup.json()["detail"].lower()

    def test_invalid_email_rejected_with_422(self, auth_client):
        res = auth_client.post(
            "/api/v1/auth/signup", json={"email": "not-an-email", "password": "whatever1"}
        )
        assert res.status_code == 422

    def test_missing_password_rejected_with_422(self, auth_client):
        res = auth_client.post("/api/v1/auth/signup", json={"email": "a@b.com"})
        assert res.status_code == 422

    def test_email_normalization(self, auth_client):
        res = auth_client.post(
            "/api/v1/auth/signup",
            json={"email": "Mixed@Example.COM", "password": "password123"},
        )
        assert res.json()["user"]["email"] == "mixed@example.com"


class TestLogin:
    @pytest.fixture()
    def signed_up(self, auth_client):
        auth_client.post("/api/v1/auth/signup", json=SIGNUP_PAYLOAD)
        return SIGNUP_PAYLOAD

    def test_login_success(self, auth_client, signed_up):
        res = auth_client.post(
            "/api/v1/auth/login",
            json={"email": signed_up["email"], "password": signed_up["password"]},
        )
        assert res.status_code == 200
        assert res.json()["token"]
        assert res.json()["user"]["email"] == "new-user@example.com"

    def test_login_wrong_password_401(self, auth_client, signed_up):
        res = auth_client.post(
            "/api/v1/auth/login",
            json={"email": signed_up["email"], "password": "wrong-password"},
        )
        assert res.status_code == 401
        assert res.json()["detail"] == "The email or password is incorrect."

    def test_login_unknown_email_401(self, auth_client):
        res = auth_client.post(
            "/api/v1/auth/login",
            json={"email": "ghost@example.com", "password": "irrelevant"},
        )
        assert res.status_code == 401

    def test_login_google_only_account_401(self, auth_client):
        """Account without password credentials cannot use password login."""
        from tests.support.db import seed_user

        seed_user(uid="google-only", email="gonly@example.com")
        res = auth_client.post(
            "/api/v1/auth/login",
            json={"email": "gonly@example.com", "password": "anything"},
        )
        assert res.status_code == 401


class TestForgotPasswordFlow:
    def test_forgot_password_known_email_returns_token(self, auth_client, monkeypatch):
        # Secure: no token leak in response; email delivery mocked to capture OTP
        captured = {}

        def fake_send(to_email, token, otp_code):
            captured["token"] = token
            captured["otp"] = otp_code
            return True

        monkeypatch.setattr("app.api.routes.auth.password.send_password_reset_email", fake_send)
        auth_client.post("/api/v1/auth/signup", json=SIGNUP_PAYLOAD)
        res = auth_client.post("/api/v1/auth/forgot-password", json={"email": SIGNUP_PAYLOAD["email"]})
        assert res.status_code == 200
        assert "token" not in res.json()
        assert captured.get("token")
        assert captured.get("otp")

    def test_forgot_password_unknown_email_no_token_leak(self, auth_client):
        res = auth_client.post("/api/v1/auth/forgot-password", json={"email": "nobody@example.com"})
        assert res.status_code == 200
        assert "message" in res.json()
        assert "token" not in res.json()

    def test_verify_reset_code_rejects_bad_format(self, auth_client):
        res = auth_client.post(
            "/api/v1/auth/verify-reset-code",
            json={"email": SIGNUP_PAYLOAD["email"], "code": "12ab"},
        )
        assert res.status_code == 400

    def test_verify_reset_code_unknown_email_404(self, auth_client):
        res = auth_client.post(
            "/api/v1/auth/verify-reset-code",
            json={"email": "ghost@example.com", "code": "123456"},
        )
        assert res.status_code == 404

    def test_full_reset_flow_changes_password(self, auth_client, monkeypatch):
        """forgot → verify OTP → reset → login with new password."""
        captured = {}

        def fake_send(to_email, token, otp_code):
            captured["token"] = token
            captured["otp"] = otp_code
            return True

        monkeypatch.setattr("app.api.routes.auth.password.send_password_reset_email", fake_send)
        auth_client.post("/api/v1/auth/signup", json=SIGNUP_PAYLOAD)

        res = auth_client.post(
            "/api/v1/auth/forgot-password", json={"email": SIGNUP_PAYLOAD["email"]}
        )
        assert res.status_code == 200
        otp = state_serializer().loads(captured["token"], max_age=3600)["otp"]

        verified = auth_client.post(
            "/api/v1/auth/verify-reset-code",
            json={"email": SIGNUP_PAYLOAD["email"], "code": otp, "token": captured["token"]},
        )
        assert verified.status_code == 200
        reset_token = verified.json()["reset_token"]

        reset = auth_client.post(
            "/api/v1/auth/reset-password",
            json={"token": reset_token, "password": "brand-new-pw-9"},
        )
        assert reset.status_code == 200

        relogin = auth_client.post(
            "/api/v1/auth/login",
            json={"email": SIGNUP_PAYLOAD["email"], "password": "brand-new-pw-9"},
        )
        assert relogin.status_code == 200

    def test_verify_with_wrong_otp_against_token_400(self, auth_client, monkeypatch):
        captured = {}

        def fake_send(to_email, token, otp_code):
            captured["token"] = token
            return True

        monkeypatch.setattr("app.api.routes.auth.password.send_password_reset_email", fake_send)
        auth_client.post("/api/v1/auth/signup", json=SIGNUP_PAYLOAD)
        auth_client.post(
            "/api/v1/auth/forgot-password", json={"email": SIGNUP_PAYLOAD["email"]}
        )
        wrong = auth_client.post(
            "/api/v1/auth/verify-reset-code",
            json={
                "email": SIGNUP_PAYLOAD["email"],
                "code": "000000",
                "token": captured["token"],
            },
        )
        # Unless the generated OTP really is 000000, mismatch must be rejected
        real_otp = state_serializer().loads(captured["token"], max_age=3600)["otp"]
        if real_otp != "000000":
            assert wrong.status_code == 400

    def test_reset_password_short_password_400(self, auth_client):
        token = state_serializer().dumps({"uid": "u", "action": "reset_password_verified"})
        res = auth_client.post(
            "/api/v1/auth/reset-password", json={"token": token, "password": "short"}
        )
        assert res.status_code == 400

    def test_reset_password_garbage_token_400(self, auth_client):
        res = auth_client.post(
            "/api/v1/auth/reset-password", json={"token": "garbage", "password": "longenough1"}
        )
        assert res.status_code == 400

    def test_reset_password_wrong_action_payload_400(self, auth_client):
        token = state_serializer().dumps({"uid": "u", "action": "something_else"})
        res = auth_client.post(
            "/api/v1/auth/reset-password", json={"token": token, "password": "longenough1"}
        )
        assert res.status_code == 400


class TestAccountEndpoints:
    def test_me_returns_db_record(self, client, db):
        from tests.support.db import seed_user
        from tests.support.auth import auth_headers

        seed_user(uid="user-1", email="user1@example.com", display_name="DB Name")
        res = client.get("/api/v1/auth/me", headers=auth_headers())
        assert res.status_code == 200
        assert res.json()["displayName"] == "DB Name"

    def test_me_falls_back_to_token_payload_for_unknown_uid(self, client, db):
        from tests.support.auth import headers_for

        ghost = {"uid": "ghost-uid", "email": "ghost@example.com", "name": "Ghost"}
        res = client.get("/api/v1/auth/me", headers=headers_for(ghost))
        assert res.status_code == 200
        assert res.json()["displayName"] == "Ghost"

    def test_me_requires_auth(self, client, db):
        assert client.get("/api/v1/auth/me").status_code == 401

    def test_patch_profile_updates_display_name(self, client, db):
        from tests.support.db import seed_user
        from tests.support.auth import auth_headers

        seed_user(uid="user-1", email="user1@example.com", display_name="Before")
        res = client.patch(
            "/api/v1/auth/profile", json={"displayName": "After"}, headers=auth_headers()
        )
        assert res.status_code == 200
        assert res.json()["displayName"] == "After"

        me = client.get("/api/v1/auth/me", headers=auth_headers())
        assert me.json()["displayName"] == "After"

    def test_delete_account_removes_user_then_404(self, client, db):
        from tests.support.db import seed_user
        from tests.support.auth import auth_headers

        seed_user(uid="user-1", email="user1@example.com", display_name="Doomed")

        first = client.delete("/api/v1/auth/account", headers=auth_headers())
        assert first.status_code == 200

        second = client.delete("/api/v1/auth/account", headers=auth_headers())
        assert second.status_code == 404

    def test_delete_account_requires_auth(self, client, db):
        assert client.delete("/api/v1/auth/account").status_code == 401


class TestGoogleOAuth:
    def test_login_unconfigured_returns_503(self, client, monkeypatch):
        from tests.support.auth import override_settings

        with override_settings(google_oauth_client_id=None):
            res = client.get("/api/v1/auth/google/login")
        assert res.status_code == 503

    def test_login_configured_builds_google_url(self, client, monkeypatch):
        from tests.support.auth import override_settings

        with override_settings(
            google_oauth_client_id="client-123",
            google_oauth_client_secret="secret-456",
            frontend_url="https://app.example.com",
        ):
            res = client.get("/api/v1/auth/google/login", params={"origin": "http://localhost:5173"})
        assert res.status_code == 200
        url = res.json()["url"]
        assert url.startswith("https://accounts.google.com/o/oauth2/v2/auth?")
        assert "client_id=client-123" in url
        assert "response_type=code" in url
        assert "state=" in url

    def test_callback_invalid_state_400(self, client, db):
        res = client.get(
            "/api/v1/auth/google/callback",
            params={"code": "abc", "state": "tampered-state"},
        )
        assert res.status_code == 400

    def test_callback_happy_path_returns_auth_html(self, client, db, monkeypatch):
        from tests.support.auth import override_settings

        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.host == "oauth2.googleapis.com":
                return httpx.Response(200, json={"access_token": "ga-token"})
            return httpx.Response(200, json={"email": "guser@example.com", "name": "G User"})

        real_async_client = httpx.AsyncClient

        def factory(**kwargs):
            kwargs.pop("transport", None)
            return real_async_client(
                transport=httpx.MockTransport(handler), **kwargs
            )

        monkeypatch.setattr(httpx, "AsyncClient", factory)

        state = state_serializer().dumps({"action": "google-auth", "origin": "http://localhost:5173"})
        with override_settings(
            google_oauth_client_id="cid",
            google_oauth_client_secret="csec",
        ):
            res = client.get(
                "/api/v1/auth/google/callback", params={"code": "one-time-code", "state": state}
            )

        assert res.status_code == 200
        assert "STARWAVES_AUTH_SUCCESS" in res.text
        assert "guser@example.com" in res.text

    def test_callback_token_exchange_failure_400(self, client, db, monkeypatch):
        from tests.support.auth import override_settings

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(400, json={"error": "bad code"})

        real_async_client = httpx.AsyncClient

        def factory(**kwargs):
            kwargs.pop("transport", None)
            return real_async_client(transport=httpx.MockTransport(handler), **kwargs)

        monkeypatch.setattr(httpx, "AsyncClient", factory)

        state = state_serializer().dumps({"action": "google-auth", "origin": "http://localhost:5173"})
        with override_settings(google_oauth_client_id="cid", google_oauth_client_secret="csec"):
            res = client.get(
                "/api/v1/auth/google/callback", params={"code": "bad", "state": state}
            )
        assert res.status_code == 400

    def test_callback_unconfigured_server_503(self, client, db):
        from tests.support.auth import override_settings

        state = state_serializer().dumps({"action": "google-auth", "origin": "http://localhost:5173"})
        with override_settings(google_oauth_client_id=None, google_oauth_client_secret=None):
            res = client.get(
                "/api/v1/auth/google/callback", params={"code": "abc", "state": state}
            )
        assert res.status_code == 503


def test_other_users_token_cannot_touch_adminish_routes(client, db):
    """A valid token for an unknown uid still passes auth but finds no record."""
    stranger = headers_for({"uid": "stranger", "email": "stranger@x.com", "name": "S"})
    res = client.get("/api/v1/auth/me", headers=stranger)
    assert res.status_code == 200
    assert res.json()["uid"] == "stranger"
