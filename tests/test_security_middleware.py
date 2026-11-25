
import unittest

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from fastapi.responses import StreamingResponse

from backend.security_middleware import SecurityMiddleware

from backend.config import (
    SECURITY_HEADERS,
    MAX_REQUEST_BODY_BYTES,
)


# =========================================
# ISOLATED TEST APPLICATION
# =========================================

def create_test_app():

    app = FastAPI()

    app.add_middleware(
        SecurityMiddleware
    )

    @app.get("/")

    async def root():

        return {
            "status": "success"
        }

    @app.post("/submit")

    async def submit(request: Request):

        body = await request.body()

        return {
            "received_bytes": len(body)
        }

    @app.delete("/delete")

    async def delete():

        return {
            "status": "deleted"
        }

    @app.get("/stream")

    async def stream():

        async def generate():

            yield "first\n"

            yield "second\n"

        return StreamingResponse(
            generate(),
            media_type="text/plain",
        )

    return app


# =========================================
# SECURITY MIDDLEWARE TESTS
# =========================================

class TestSecurityMiddleware(unittest.TestCase):

    def setUp(self):

        self.app = create_test_app()

        self.client = TestClient(
            self.app,
            base_url="http://127.0.0.1:8000",
        )

    def tearDown(self):

        self.client.close()


    # =====================================
    # TRUSTED HOST TESTS
    # =====================================

    def test_localhost_allowed(self):

        response = self.client.get(
            "/",
            headers={
                "Host": "localhost:8000"
            },
        )

        self.assertEqual(
            response.status_code, 200
        )

    def test_loopback_allowed(self):

        response = self.client.get("/")

        self.assertEqual(
            response.status_code, 200
        )

    def test_ipv6_loopback_allowed(self):

        response = self.client.get(
            "/",
            headers={
                "Host": "[::1]:8000"
            },
        )

        self.assertEqual(
            response.status_code, 200
        )

    def test_untrusted_host_rejected(self):

        response = self.client.get(
            "/",
            headers={
                "Host": "example.com"
            },
        )

        self.assertEqual(
            response.status_code, 400
        )

    def test_malformed_host_rejected(self):

        response = self.client.get(
            "/",
            headers={
                "Host": "localhost:invalid"
            },
        )

        self.assertEqual(
            response.status_code, 400
        )

    def test_empty_host_rejected(self):

        response = self.client.get(
            "/",
            headers={
                "Host": ""
            },
        )

        self.assertEqual(
            response.status_code, 400
        )


    # =====================================
    # ORIGIN PROTECTION TESTS
    # =====================================

    def test_development_origin_allowed(self):

        response = self.client.post(
            "/submit",
            json={"message": "test"},
            headers={
                "Origin": "http://localhost:5173"
            },
        )

        self.assertEqual(
            response.status_code, 200
        )

    def test_preview_origin_allowed(self):

        response = self.client.post(
            "/submit",
            json={"message": "test"},
            headers={
                "Origin": "http://127.0.0.1:4173"
            },
        )

        self.assertEqual(
            response.status_code, 200
        )

    def test_untrusted_origin_rejected(self):

        response = self.client.post(
            "/submit",
            json={"message": "test"},
            headers={
                "Origin": "https://example.com"
            },
        )

        self.assertEqual(
            response.status_code, 403
        )

    def test_null_origin_rejected(self):

        response = self.client.post(
            "/submit",
            headers={
                "Origin": "null"
            },
        )

        self.assertEqual(
            response.status_code, 403
        )

    def test_originless_client_allowed(self):

        response = self.client.post(
            "/submit",
            json={"message": "test"},
        )

        self.assertEqual(
            response.status_code, 200
        )


    # =====================================
    # CROSS-SITE REQUEST TESTS
    # =====================================

    def test_cross_site_post_rejected(self):

        response = self.client.post(
            "/submit",
            headers={
                "Sec-Fetch-Site": "cross-site"
            },
        )

        self.assertEqual(
            response.status_code, 403
        )

    def test_cross_site_delete_rejected(self):

        response = self.client.delete(
            "/delete",
            headers={
                "Sec-Fetch-Site": "cross-site"
            },
        )

        self.assertEqual(
            response.status_code, 403
        )

    def test_same_origin_request_allowed(self):

        response = self.client.post(
            "/submit",
            headers={
                "Sec-Fetch-Site": "same-origin"
            },
        )

        self.assertEqual(
            response.status_code, 200
        )


    # =====================================
    # REQUEST SIZE TESTS
    # =====================================

    def test_small_request_allowed(self):

        response = self.client.post(
            "/submit",
            content=b"hello",
        )

        self.assertEqual(
            response.status_code, 200
        )

        self.assertEqual(
            response.json()["received_bytes"],
            5,
        )

    def test_exact_limit_allowed(self):

        body = b"a" * MAX_REQUEST_BODY_BYTES

        response = self.client.post(
            "/submit",
            content=body,
        )

        self.assertEqual(
            response.status_code, 200
        )

        self.assertEqual(
            response.json()["received_bytes"],
            MAX_REQUEST_BODY_BYTES,
        )

    def test_oversized_request_rejected(self):

        body = b"a" * (
            MAX_REQUEST_BODY_BYTES + 1
        )

        response = self.client.post(
            "/submit",
            content=body,
        )

        self.assertEqual(
            response.status_code, 413
        )

    def test_invalid_content_length(self):

        response = self.client.post(
            "/submit",
            content=b"hello",
            headers={
                "Content-Length": "invalid"
            },
        )

        self.assertEqual(
            response.status_code, 400
        )

    def test_negative_content_length(self):

        response = self.client.post(
            "/submit",
            headers={
                "Content-Length": "-1"
            },
        )

        self.assertEqual(
            response.status_code, 400
        )

    def test_mismatched_content_length(self):

        response = self.client.post(
            "/submit",
            content=b"hello",
            headers={
                "Content-Length": "2"
            },
        )

        self.assertEqual(
            response.status_code, 400
        )


    # =====================================
    # SECURITY RESPONSE HEADER TESTS
    # =====================================

    def test_success_response_headers(self):

        response = self.client.get("/")

        self.assertEqual(
            response.status_code, 200
        )

        for name, value in SECURITY_HEADERS.items():

            self.assertEqual(
                response.headers.get(name),
                value,
            )

    def test_rejected_response_headers(self):

        response = self.client.get(
            "/",
            headers={
                "Host": "example.com"
            },
        )

        self.assertEqual(
            response.status_code, 400
        )

        for name, value in SECURITY_HEADERS.items():

            self.assertEqual(
                response.headers.get(name),
                value,
            )

    def test_not_found_response_headers(self):

        response = self.client.get(
            "/nonexistent"
        )

        self.assertEqual(
            response.status_code, 404
        )

        for name, value in SECURITY_HEADERS.items():

            self.assertEqual(
                response.headers.get(name),
                value,
            )


    # =====================================
    # STREAMING COMPATIBILITY
    # =====================================

    def test_streaming_response(self):

        with self.client.stream(
            "GET",
            "/stream",
        ) as response:

            self.assertEqual(
                response.status_code, 200
            )

            content = "".join(
                response.iter_text()
            )

        self.assertEqual(
            content,
            "first\nsecond\n",
        )

    def test_streaming_security_headers(self):

        with self.client.stream(
            "GET",
            "/stream",
        ) as response:

            for name, value in SECURITY_HEADERS.items():

                self.assertEqual(
                    response.headers.get(name),
                    value,
                )


if __name__ == "__main__":

    unittest.main()
