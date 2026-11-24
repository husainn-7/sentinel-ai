import unittest

from unittest.mock import patch
from fastapi.testclient import TestClient

from backend.api import app


client = TestClient(app)


class TestSentinelAPI(unittest.TestCase):

    def test_root_endpoint(self):

        response = client.get("/")

        self.assertEqual(response.status_code, 200)

        self.assertEqual(
            response.json()["application"],
            "Sentinel AI"
        )


    def test_health_endpoint(self):

        response = client.get("/health")

        self.assertEqual(response.status_code, 200)

        self.assertEqual(
            response.json()["status"],
            "healthy"
        )


    @patch("backend.api.chat")
    def test_chat_endpoint(self, mock_chat):

        mock_chat.return_value = "Test AI response"

        response = client.post(
            "/chat",
            json={
                "message": "What is phishing?"
            }
        )

        self.assertEqual(response.status_code, 200)

        self.assertEqual(
            response.json()["response"],
            "Test AI response"
        )

        mock_chat.assert_called_once_with(
            "What is phishing?"
        )


    def test_empty_chat_message(self):

        response = client.post(
            "/chat",
            json={"message": ""}
        )

        self.assertEqual(response.status_code, 422)


    def test_missing_chat_message(self):

        response = client.post(
            "/chat",
            json={}
        )

        self.assertEqual(response.status_code, 422)


    def test_unexpected_field(self):

        response = client.post(
            "/chat",
            json={
                "message": "Hello",
                "unexpected": True
            }
        )

        self.assertEqual(response.status_code, 422)


    @patch("backend.api.chat")
    def test_ai_service_unavailable(self, mock_chat):

        mock_chat.side_effect = RuntimeError(
            "Ollama unavailable"
        )

        response = client.post(
            "/chat",
            json={"message": "Hello"}
        )

        self.assertEqual(response.status_code, 503)


    def test_phishing_endpoint(self):

        response = client.post(
            "/phishing",
            json={
                "email_text":
                    "URGENT! Verify your password immediately.",
                "include_ai_report": False
            }
        )

        self.assertEqual(response.status_code, 200)

        data = response.json()

        self.assertEqual(data["status"], "success")

        self.assertGreater(
            data["analysis"]["risk_score"], 0
        )

        self.assertIsNone(data["ai_report"])


    def test_empty_phishing_input(self):

        response = client.post(
            "/phishing",
            json={
                "email_text": "",
                "include_ai_report": False
            }
        )

        self.assertEqual(response.status_code, 422)


    def test_log_endpoint(self):

        logs = (
            "Nov 24 10:00:01 server sshd[1001]: "
            "Failed password for invalid user admin "
            "from 192.0.2.10 port 50100 ssh2"
        )

        response = client.post(
            "/logs",
            json={
                "log_text": logs,
                "include_ai_report": False
            }
        )

        self.assertEqual(response.status_code, 200)

        self.assertEqual(
            response.json()["analysis"]["summary"]["total_events"],
            1
        )


    def test_invalid_log_content(self):

        response = client.post(
            "/logs",
            json={
                "log_text": "Invalid logs",
                "include_ai_report": False
            }
        )

        self.assertEqual(response.status_code, 200)

        self.assertEqual(
            response.json()["status"],
            "no_valid_events"
        )


    def test_anomaly_endpoint(self):

        logs = "\n".join(
            f"Nov 24 10:01:{i:02d} server sshd[{2000+i}]: "
            f"Failed password for invalid user admin "
            f"from 198.51.100.20 port {51000+i} ssh2"
            for i in range(30)
        )

        response = client.post(
            "/anomaly",
            json={
                "log_text": logs,
                "include_ai_report": False
            }
        )

        self.assertEqual(response.status_code, 200)

        analysis = response.json()["analysis"]

        self.assertEqual(analysis["total_windows"], 1)
        self.assertEqual(analysis["ml_anomalies"], 1)
        self.assertEqual(analysis["rule_alerts"], 1)


    def test_invalid_anomaly_content(self):

        response = client.post(
            "/anomaly",
            json={
                "log_text": "Invalid logs",
                "include_ai_report": False
            }
        )

        self.assertEqual(response.status_code, 200)

        self.assertEqual(
            response.json()["status"],
            "no_valid_windows"
        )


    @patch("backend.api.stream_chat_response")
    def test_streaming_endpoint(self, mock_stream):

        mock_stream.return_value = iter([
            'data: {"type": "token", "content": "Hello"}\n\n',
            'data: {"type": "done"}\n\n'
        ])

        response = client.post(
            "/chat/stream",
            json={"message": "Hello"}
        )

        self.assertEqual(response.status_code, 200)

        self.assertIn(
            "text/event-stream",
            response.headers["content-type"]
        )

        self.assertIn(
            '"type": "token"',
            response.text
        )

        self.assertIn(
            '"type": "done"',
            response.text
        )


    def test_api_documentation(self):

        response = client.get("/docs")

        self.assertEqual(response.status_code, 200)


if __name__ == "__main__":
    unittest.main()