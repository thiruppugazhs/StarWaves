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
