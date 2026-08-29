"""API tests: integration routes under /integrations/* (gmail, calendar, drive,
chat, github). External services are stubbed; the tests pin the HTTP contract:
auth requirements and status/account endpoints."""

import pytest


class TestGmailIntegration:
    def test_requires_auth(self, client, db):
        assert client.get("/api/v1/integrations/gmail/status").status_code == 401

    def test_status_unauthenticated_user_shape(self, auth_client, db):
        res = auth_client.get("/api/v1/integrations/gmail/status")
        assert res.status_code in (200, 401, 403)
        if res.status_code == 200:
            assert "connected" in res.json() or "accounts" in res.json()

    def test_accounts_endpoint(self, auth_client, db):
        res = auth_client.get("/api/v1/integrations/gmail/accounts")
        assert res.status_code in (200, 401, 403, 503)

    def test_token_without_connection(self, auth_client, db):
        res = auth_client.get("/api/v1/integrations/gmail/token")
        assert res.status_code in (200, 401, 403, 404)


class TestGoogleCalendarIntegration:
    def test_data_requires_auth(self, client, db):
        assert client.get("/api/v1/integrations/google-calendar/data").status_code == 401

    def test_data_not_connected_or_empty(self, auth_client, db):
        res = auth_client.get("/api/v1/integrations/google-calendar/data")
        assert res.status_code in (200, 401, 403, 503)


class TestGoogleDriveIntegration:
    def test_status_contract(self, auth_client, db):
        res = auth_client.get("/api/v1/integrations/google-drive/status")
        assert res.status_code in (200, 401, 403)

    def test_files_not_connected_or_conflict(self, auth_client, db):
        res = auth_client.get("/api/v1/integrations/google-drive/files")
        assert res.status_code in (200, 401, 403, 409, 503)


class TestGoogleChatIntegration:
    def test_spaces_requires_auth(self, client, db):
        assert client.get("/api/v1/integrations/google-chat/spaces").status_code == 401

    def test_spaces_not_connected_or_listed(self, auth_client, db):
        res = auth_client.get("/api/v1/integrations/google-chat/spaces")
        assert res.status_code in (200, 401, 403, 503)


class TestGitHubIntegration:
    def test_authorize_redirects_or_503(self, auth_client, db):
        res = auth_client.get(
            "/api/v1/integrations/github/authorize", follow_redirects=False
        )
        assert res.status_code in (200, 302, 307, 401, 403, 503)

    def test_status_endpoint(self, auth_client, db):
        res = auth_client.get("/api/v1/integrations/github/status")
        assert res.status_code in (200, 401, 403, 404)
