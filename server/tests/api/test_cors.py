import unittest
from fastapi.testclient import TestClient

from app.main import create_app


class TestCORSAndErrorMiddleware(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.client = TestClient(self.app, raise_server_exceptions=False)

    def test_cors_headers_on_health(self):
        origins = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:3000",
            "capacitor://localhost",
            "https://starwaves.susindran.in",
            "https://api.starwaves.susindran.in",
        ]
        for origin in origins:
            response = self.client.get("/api/v1/health", headers={"Origin": origin})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(
                response.headers.get("access-control-allow-origin"),
                origin,
            )
            self.assertEqual(
                response.headers.get("access-control-allow-credentials"),
                "true",
            )

    def test_cors_preflight_options(self):
        origin = "http://localhost:5173"
        response = self.client.options(
            "/api/v1/health",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "Authorization, Content-Type",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.headers.get("access-control-allow-origin"),
            origin,
        )

    def test_preview_allows_configured_frontend_framing(self):
        response = self.client.get(
            "/api/v1/studio/preview/not-a-valid-token/index.html",
            headers={"Origin": "http://localhost:5173"},
        )
        self.assertEqual(response.status_code, 403)
        self.assertIsNone(response.headers.get("x-frame-options"))
        policy = response.headers.get("content-security-policy", "")
        self.assertIn("frame-ancestors", policy)
        self.assertIn("http://localhost:5173", policy)

    def test_normal_api_response_retains_frame_protection(self):
        response = self.client.get("/api/v1/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("x-frame-options"), "SAMEORIGIN")
        self.assertIn("frame-ancestors 'self'", response.headers.get("content-security-policy", ""))

    def test_missing_studio_preview_project_returns_not_found(self):
        from app.core.auth import create_user_token

        response = self.client.post(
            "/api/v1/studio/projects/missing-project/preview",
            headers={"Authorization": f"Bearer {create_user_token({'uid': 'preview-test-user'})}"},
        )
        self.assertEqual(response.status_code, 404)
        self.assertIn("not found", response.json()["detail"].lower())

    def test_cors_headers_on_500_error(self):
        @self.app.get("/api/v1/test-error")
        def throw_error():
            raise RuntimeError("Test server exception")

        origin = "http://localhost:5173"
        response = self.client.get("/api/v1/test-error", headers={"Origin": origin})
        self.assertEqual(response.status_code, 500)
        self.assertEqual(
            response.headers.get("access-control-allow-origin"),
            origin,
        )
