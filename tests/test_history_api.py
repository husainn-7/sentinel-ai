
import unittest

from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.history_router import (
    router,
    get_database_path,
)

from database.db import (
    initialize_database,
)

from database.conversations import (
    create_conversation,
    save_chat_turn,
    get_messages,
)

from database.investigations import (
    save_investigation,
)


# =========================================
# ISOLATED HISTORY API TEST FOUNDATION
# =========================================

class HistoryAPITestCase(unittest.TestCase):

    def setUp(self):

        self.temp_directory = TemporaryDirectory()

        self.addCleanup(
            self.temp_directory.cleanup
        )

        self.db_path = (
            Path(self.temp_directory.name)
            / "test_history_api.db"
        )

        initialize_database(
            self.db_path
        )

        # Create an isolated FastAPI application
        # containing only the History router.

        self.app = FastAPI()

        self.app.include_router(router)

        self.app.dependency_overrides[
            get_database_path
        ] = lambda: self.db_path

        self.client = TestClient(
            self.app
        )

        self.addCleanup(
            self.client.close
        )


    def seed_conversation(
        self,
        title="Test conversation"
    ):

        return create_conversation(

            title=title,

            db_path=self.db_path,

        )


    def seed_investigation(
        self,
        investigation_type="phishing"
    ):

        samples = {

            "phishing": {

                "risk_score": 75,

                "risk_level": "High",

            },

            "logs": {

                "overall_risk": "Critical",

                "summary": {

                    "total_events": 21,

                    "failed_logins": 18,

                    "successful_logins": 3,

                },

            },

            "anomaly": {

                "total_windows": 3,

                "ml_anomalies": 1,

                "rule_alerts": 2,

            },

        }

        return save_investigation(

            investigation_type,

            samples[investigation_type],

            db_path=self.db_path,

        )


# =========================================
# SYSTEM INFORMATION TESTS
# =========================================

class TestHistorySystemAPI(
    HistoryAPITestCase
):

    def test_empty_history_statistics(self):

        response = self.client.get(
            "/history/stats"
        )

        self.assertEqual(
            response.status_code,
            200
        )

        data = response.json()

        self.assertEqual(

            data["conversations"]
            ["total_conversations"],

            0

        )

        self.assertEqual(

            data["investigations"]
            ["total_investigations"],

            0

        )


    def test_populated_history_statistics(self):

        conversation = self.seed_conversation()

        save_chat_turn(

            conversation["id"],

            "What is phishing?",

            "A deceptive attempt to obtain information.",

            db_path=self.db_path,

        )

        self.seed_investigation(
            "phishing"
        )

        self.seed_investigation(
            "logs"
        )

        self.seed_investigation(
            "anomaly"
        )

        response = self.client.get(
            "/history/stats"
        )

        self.assertEqual(
            response.status_code,
            200
        )

        data = response.json()

        self.assertEqual(

            data["conversations"]
            ["total_conversations"],

            1

        )

        self.assertEqual(

            data["conversations"]
            ["total_messages"],

            2

        )

        self.assertEqual(

            data["investigations"]
            ["total_investigations"],

            3

        )


    def test_database_information(self):

        response = self.client.get(
            "/history/database"
        )

        self.assertEqual(
            response.status_code,
            200
        )

        data = response.json()

        self.assertEqual(
            data["integrity"],
            "ok"
        )

        self.assertEqual(
            data["schema_version"],
            1
        )

        self.assertEqual(

            set(data["tables"]),

            {

                "conversations",

                "messages",

                "investigations",

            }

        )

        self.assertNotIn(

            "database_path",

            data

        )


# =========================================
# CONVERSATION API TESTS
# =========================================

class TestConversationAPI(
    HistoryAPITestCase
):

    def test_create_conversation(self):

        response = self.client.post(

            "/history/conversations",

            json={

                "title": "SSH security discussion"

            }

        )

        self.assertEqual(
            response.status_code,
            201
        )

        data = response.json()

        self.assertTrue(data["id"])

        self.assertEqual(

            data["title"],

            "SSH security discussion"

        )


    def test_default_conversation_title(self):

        response = self.client.post(

            "/history/conversations",

            json={}

        )

        self.assertEqual(
            response.status_code,
            201
        )

        self.assertEqual(

            response.json()["title"],

            "New conversation"

        )


    def test_invalid_conversation_title(self):

        response = self.client.post(

            "/history/conversations",

            json={

                "title": "   "

            }

        )

        self.assertEqual(
            response.status_code,
            422
        )


    def test_list_conversations(self):

        self.seed_conversation(
            "First conversation"
        )

        self.seed_conversation(
            "Second conversation"
        )

        response = self.client.get(
            "/history/conversations"
        )

        self.assertEqual(
            response.status_code,
            200
        )

        data = response.json()

        self.assertEqual(
            data["count"],
            2
        )

        self.assertEqual(

            len(data["conversations"]),

            2

        )


    def test_conversation_pagination(self):

        for index in range(3):

            self.seed_conversation(
                f"Conversation {index}"
            )

        response = self.client.get(

            "/history/conversations",

            params={

                "limit": 1,

                "offset": 1,

            }

        )

        self.assertEqual(
            response.status_code,
            200
        )

        self.assertEqual(

            response.json()["count"],

            1

        )


    def test_search_conversations(self):

        conversation = self.seed_conversation(
            "Network security"
        )

        self.seed_conversation(
            "Python programming"
        )

        save_chat_turn(

            conversation["id"],

            "Explain SSH authentication.",

            "SSH supports secure remote access.",

            db_path=self.db_path,

        )

        response = self.client.get(

            "/history/conversations",

            params={

                "q": "authentication"

            }

        )

        self.assertEqual(
            response.status_code,
            200
        )

        data = response.json()

        self.assertEqual(
            data["count"],
            1
        )

        self.assertEqual(

            data["conversations"][0]["id"],

            conversation["id"]

        )


    def test_retrieve_conversation_with_messages(self):

        conversation = self.seed_conversation()

        save_chat_turn(

            conversation["id"],

            "Hello Sentinel.",

            "Hello. How can I help?",

            db_path=self.db_path,

        )

        response = self.client.get(

            f"/history/conversations/"
            f"{conversation['id']}"

        )

        self.assertEqual(
            response.status_code,
            200
        )

        messages = response.json()[
            "messages"
        ]

        self.assertEqual(
            len(messages),
            2
        )

        self.assertEqual(

            messages[0]["role"],

            "user"

        )

        self.assertEqual(

            messages[1]["role"],

            "assistant"

        )


    def test_missing_conversation_returns_404(self):

        response = self.client.get(

            "/history/conversations/nonexistent-id"

        )

        self.assertEqual(
            response.status_code,
            404
        )


    def test_rename_conversation(self):

        conversation = self.seed_conversation()

        conversation_id = conversation["id"]

        response = self.client.patch(

            f"/history/conversations/{conversation_id}",

            json={

                "title": "Updated conversation"

            }

        )

        self.assertEqual(
            response.status_code,
            200
        )

        retrieved = self.client.get(

            f"/history/conversations/{conversation_id}"

        )

        self.assertEqual(

            retrieved.json()["title"],

            "Updated conversation"

        )


    def test_delete_conversation_and_messages(self):

        conversation = self.seed_conversation()

        conversation_id = conversation["id"]

        save_chat_turn(

            conversation_id,

            "Hello.",

            "Hello.",

            db_path=self.db_path,

        )

        response = self.client.delete(

            f"/history/conversations/{conversation_id}"

        )

        self.assertEqual(
            response.status_code,
            200
        )

        self.assertEqual(

            get_messages(

                conversation_id,

                db_path=self.db_path,

            ),

            []

        )

        retrieved = self.client.get(

            f"/history/conversations/{conversation_id}"

        )

        self.assertEqual(
            retrieved.status_code,
            404
        )


# =========================================
# INVESTIGATION API TESTS
# =========================================

class TestInvestigationAPI(
    HistoryAPITestCase
):

    def test_list_investigations(self):

        self.seed_investigation(
            "phishing"
        )

        self.seed_investigation(
            "logs"
        )

        self.seed_investigation(
            "anomaly"
        )

        response = self.client.get(

            "/history/investigations"

        )

        self.assertEqual(
            response.status_code,
            200
        )

        data = response.json()

        self.assertEqual(
            data["count"],
            3
        )

        for investigation in data[
            "investigations"
        ]:

            self.assertNotIn(

                "analysis",

                investigation

            )


    def test_filter_investigations_by_type(self):

        self.seed_investigation(
            "phishing"
        )

        self.seed_investigation(
            "logs"
        )

        response = self.client.get(

            "/history/investigations",

            params={

                "investigation_type": "phishing"

            }

        )

        self.assertEqual(
            response.status_code,
            200
        )

        data = response.json()

        self.assertEqual(
            data["count"],
            1
        )

        self.assertEqual(

            data["investigations"][0]
            ["investigation_type"],

            "phishing"

        )


    def test_invalid_investigation_type(self):

        response = self.client.get(

            "/history/investigations",

            params={

                "investigation_type": "invalid"

            }

        )

        self.assertEqual(
            response.status_code,
            422
        )


    def test_search_investigations(self):

        self.seed_investigation(
            "phishing"
        )

        investigation = self.seed_investigation(
            "logs"
        )

        response = self.client.get(

            "/history/investigations",

            params={

                "q": "Critical"

            }

        )

        self.assertEqual(
            response.status_code,
            200
        )

        data = response.json()

        self.assertEqual(
            data["count"],
            1
        )

        self.assertEqual(

            data["investigations"][0]["id"],

            investigation["id"]

        )


    def test_retrieve_full_investigation(self):

        investigation = self.seed_investigation(
            "phishing"
        )

        investigation_id = investigation["id"]

        response = self.client.get(

            f"/history/investigations/{investigation_id}"

        )

        self.assertEqual(
            response.status_code,
            200
        )

        data = response.json()

        self.assertEqual(

            data["analysis"]["risk_score"],

            75

        )

        self.assertEqual(

            data["risk_level"],

            "High"

        )


    def test_rename_investigation(self):

        investigation = self.seed_investigation(
            "logs"
        )

        investigation_id = investigation["id"]

        response = self.client.patch(

            f"/history/investigations/{investigation_id}",

            json={

                "title": "SSH incident review"

            }

        )

        self.assertEqual(
            response.status_code,
            200
        )

        retrieved = self.client.get(

            f"/history/investigations/{investigation_id}"

        )

        self.assertEqual(

            retrieved.json()["title"],

            "SSH incident review"

        )


    def test_delete_investigation(self):

        investigation = self.seed_investigation(
            "anomaly"
        )

        investigation_id = investigation["id"]

        response = self.client.delete(

            f"/history/investigations/{investigation_id}"

        )

        self.assertEqual(
            response.status_code,
            200
        )

        retrieved = self.client.get(

            f"/history/investigations/{investigation_id}"

        )

        self.assertEqual(
            retrieved.status_code,
            404
        )


# =========================================
# TEST RUNNER
# =========================================

if __name__ == "__main__":

    unittest.main(
        verbosity=2
    )
