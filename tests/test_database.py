
import unittest

from pathlib import Path
from tempfile import TemporaryDirectory

from database.db import (
    initialize_database,
    get_database_info,
    get_connection,
)

from database.conversations import (
    create_conversation,
    get_conversation,
    add_message,
    save_chat_turn,
    get_messages,
    get_recent_context,
    list_conversations,
    search_conversations,
    rename_conversation,
    delete_conversation,
    get_conversation_statistics,
)

from database.investigations import (
    save_investigation,
    get_investigation,
    list_investigations,
    search_investigations,
    rename_investigation,
    delete_investigation,
    get_investigation_statistics,
)


# =========================================
# TEMPORARY DATABASE TEST FOUNDATION
# =========================================

class DatabaseTestCase(unittest.TestCase):

    def setUp(self):

        self.temp_directory = TemporaryDirectory()

        self.addCleanup(
            self.temp_directory.cleanup
        )

        self.db_path = (
            Path(self.temp_directory.name)
            / "test_sentinel.db"
        )

        initialize_database(
            self.db_path
        )


# =========================================
# DATABASE INITIALIZATION TESTS
# =========================================

class TestDatabaseInitialization(DatabaseTestCase):

    def test_database_created(self):

        self.assertTrue(
            self.db_path.exists()
        )


    def test_schema_and_tables(self):

        information = get_database_info(
            self.db_path
        )

        self.assertEqual(
            information["schema_version"],
            1
        )

        self.assertEqual(

            set(information["tables"]),

            {
                "conversations",
                "messages",
                "investigations",
            }

        )

        self.assertEqual(
            information["integrity"],
            "ok"
        )


    def test_foreign_keys_enabled(self):

        with get_connection(
            self.db_path
        ) as connection:

            enabled = connection.execute(
                "PRAGMA foreign_keys"
            ).fetchone()[0]

        self.assertEqual(enabled, 1)


    def test_reinitialization_preserves_data(self):

        conversation = create_conversation(

            title="Persistence test",

            db_path=self.db_path

        )

        initialize_database(
            self.db_path
        )

        retrieved = get_conversation(

            conversation["id"],

            db_path=self.db_path

        )

        self.assertIsNotNone(retrieved)

        self.assertEqual(

            retrieved["title"],

            "Persistence test"

        )


# =========================================
# CONVERSATION STORAGE TESTS
# =========================================

class TestConversationStorage(DatabaseTestCase):

    def test_create_conversation(self):

        conversation = create_conversation(

            title="SSH security",

            db_path=self.db_path

        )

        self.assertTrue(
            conversation["id"]
        )

        self.assertEqual(

            conversation["title"],

            "SSH security"

        )

        self.assertTrue(
            conversation["created_at"]
        )

        self.assertTrue(
            conversation["updated_at"]
        )


    def test_unique_conversation_ids(self):

        first = create_conversation(
            db_path=self.db_path
        )

        second = create_conversation(
            db_path=self.db_path
        )

        self.assertNotEqual(

            first["id"],

            second["id"]

        )


    def test_retrieve_conversation(self):

        conversation = create_conversation(

            title="Saved conversation",

            db_path=self.db_path

        )

        retrieved = get_conversation(

            conversation["id"],

            db_path=self.db_path

        )

        self.assertEqual(
            retrieved,
            conversation
        )


    def test_missing_conversation(self):

        retrieved = get_conversation(

            "nonexistent-id",

            db_path=self.db_path

        )

        self.assertIsNone(retrieved)


    def test_add_message(self):

        conversation = create_conversation(
            db_path=self.db_path
        )

        message = add_message(

            conversation["id"],

            "user",

            "What is phishing?",

            db_path=self.db_path

        )

        self.assertEqual(
            message["role"],
            "user"
        )

        self.assertEqual(

            message["content"],

            "What is phishing?"

        )

        self.assertEqual(

            message["conversation_id"],

            conversation["id"]

        )


    def test_invalid_message_role(self):

        conversation = create_conversation(
            db_path=self.db_path
        )

        with self.assertRaises(ValueError):

            add_message(

                conversation["id"],

                "system",

                "Invalid role",

                db_path=self.db_path

            )


    def test_empty_message_rejected(self):

        conversation = create_conversation(
            db_path=self.db_path
        )

        with self.assertRaises(ValueError):

            add_message(

                conversation["id"],

                "user",

                "   ",

                db_path=self.db_path

            )


    def test_save_complete_chat_turn(self):

        conversation = create_conversation(
            db_path=self.db_path
        )

        result = save_chat_turn(

            conversation["id"],

            "Explain brute-force attacks.",

            "Repeated authentication attempts.",

            db_path=self.db_path

        )

        messages = get_messages(

            conversation["id"],

            db_path=self.db_path

        )

        self.assertEqual(
            result["messages_saved"],
            2
        )

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


    def test_automatic_conversation_title(self):

        conversation = create_conversation(
            db_path=self.db_path
        )

        save_chat_turn(

            conversation["id"],

            "Explain machine learning.",

            "Machine learning learns patterns from data.",

            db_path=self.db_path

        )

        retrieved = get_conversation(

            conversation["id"],

            db_path=self.db_path

        )

        self.assertEqual(

            retrieved["title"],

            "Explain machine learning."

        )


    def test_message_history_order_and_limit(self):

        conversation = create_conversation(
            db_path=self.db_path
        )

        for index in range(8):

            add_message(

                conversation["id"],

                "user" if index % 2 == 0
                else "assistant",

                f"Message {index}",

                db_path=self.db_path

            )

        messages = get_messages(

            conversation["id"],

            limit=3,

            db_path=self.db_path

        )

        self.assertEqual(
            len(messages),
            3
        )

        self.assertEqual(

            [message["content"]
             for message in messages],

            [
                "Message 5",
                "Message 6",
                "Message 7",
            ]

        )


    def test_recent_context_limits(self):

        conversation = create_conversation(
            db_path=self.db_path
        )

        for index in range(10):

            add_message(

                conversation["id"],

                "user" if index % 2 == 0
                else "assistant",

                "A" * 1000,

                db_path=self.db_path

            )

        context = get_recent_context(

            conversation["id"],

            max_messages=6,

            max_characters=2500,

            db_path=self.db_path

        )

        self.assertEqual(
            len(context),
            2
        )

        self.assertLessEqual(

            sum(
                len(message["content"])
                for message in context
            ),

            2500

        )

        self.assertEqual(

            set(context[0].keys()),

            {"role", "content"}

        )


    def test_list_and_search_conversations(self):

        first = create_conversation(

            title="Network security",

            db_path=self.db_path

        )

        create_conversation(

            title="Python programming",

            db_path=self.db_path

        )

        add_message(

            first["id"],

            "user",

            "Explain SSH authentication.",

            db_path=self.db_path

        )

        conversations = list_conversations(
            db_path=self.db_path
        )

        self.assertEqual(
            len(conversations),
            2
        )

        results = search_conversations(

            "SSH",

            db_path=self.db_path

        )

        self.assertEqual(
            len(results),
            1
        )

        self.assertEqual(

            results[0]["id"],

            first["id"]

        )


    def test_rename_conversation(self):

        conversation = create_conversation(
            db_path=self.db_path
        )

        updated = rename_conversation(

            conversation["id"],

            "Updated security discussion",

            db_path=self.db_path

        )

        retrieved = get_conversation(

            conversation["id"],

            db_path=self.db_path

        )

        self.assertTrue(updated)

        self.assertEqual(

            retrieved["title"],

            "Updated security discussion"

        )


    def test_delete_conversation_cascade(self):

        conversation = create_conversation(
            db_path=self.db_path
        )

        save_chat_turn(

            conversation["id"],

            "Hello Sentinel.",

            "Hello.",

            db_path=self.db_path

        )

        deleted = delete_conversation(

            conversation["id"],

            db_path=self.db_path

        )

        self.assertTrue(deleted)

        self.assertIsNone(

            get_conversation(

                conversation["id"],

                db_path=self.db_path

            )

        )

        self.assertEqual(

            get_messages(

                conversation["id"],

                db_path=self.db_path

            ),

            []

        )


    def test_conversation_statistics(self):

        conversation = create_conversation(
            db_path=self.db_path
        )

        save_chat_turn(

            conversation["id"],

            "Hello.",

            "How can I help?",

            db_path=self.db_path

        )

        statistics = get_conversation_statistics(
            db_path=self.db_path
        )

        self.assertEqual(

            statistics["total_conversations"],

            1

        )

        self.assertEqual(

            statistics["total_messages"],

            2

        )

        self.assertEqual(

            statistics["user_messages"],

            1

        )

        self.assertEqual(

            statistics["assistant_messages"],

            1

        )


# =========================================
# INVESTIGATION STORAGE TESTS
# =========================================

class TestInvestigationStorage(DatabaseTestCase):

    def test_save_phishing_investigation(self):

        investigation = save_investigation(

            "phishing",

            {
                "risk_score": 75,
                "risk_level": "High",
            },

            db_path=self.db_path

        )

        self.assertTrue(
            investigation["id"]
        )

        self.assertEqual(

            investigation["investigation_type"],

            "phishing"

        )

        self.assertEqual(

            investigation["risk_level"],

            "High"

        )

        self.assertEqual(

            investigation["analysis"]["risk_score"],

            75

        )


    def test_save_log_investigation(self):

        investigation = save_investigation(

            "logs",

            {

                "overall_risk": "Critical",

                "summary": {

                    "total_events": 21,

                    "failed_logins": 18,

                    "successful_logins": 3,

                },

            },

            db_path=self.db_path

        )

        self.assertEqual(

            investigation["risk_level"],

            "Critical"

        )

        self.assertEqual(

            investigation["analysis"]
            ["summary"]["total_events"],

            21

        )


    def test_anomaly_does_not_invent_risk(self):

        investigation = save_investigation(

            "anomaly",

            {

                "total_windows": 3,

                "ml_anomalies": 1,

                "rule_alerts": 2,

            },

            db_path=self.db_path

        )

        self.assertIsNone(

            investigation["risk_level"]

        )


    def test_save_and_retrieve_ai_report(self):

        investigation = save_investigation(

            "phishing",

            {"risk_level": "High"},

            ai_report="Investigate suspicious indicators.",

            db_path=self.db_path

        )

        retrieved = get_investigation(

            investigation["id"],

            db_path=self.db_path

        )

        self.assertEqual(

            retrieved["ai_report"],

            "Investigate suspicious indicators."

        )


    def test_invalid_investigation_type(self):

        with self.assertRaises(ValueError):

            save_investigation(

                "unsupported",

                {},

                db_path=self.db_path

            )


    def test_invalid_json_rejected(self):

        with self.assertRaises(ValueError):

            save_investigation(

                "anomaly",

                {
                    "invalid_value": float("nan")
                },

                db_path=self.db_path

            )


    def test_list_and_filter_investigations(self):

        save_investigation(

            "phishing",

            {"risk_level": "High"},

            db_path=self.db_path

        )

        save_investigation(

            "logs",

            {"overall_risk": "Low"},

            db_path=self.db_path

        )

        investigations = list_investigations(
            db_path=self.db_path
        )

        filtered = list_investigations(

            investigation_type="phishing",

            db_path=self.db_path

        )

        self.assertEqual(
            len(investigations),
            2
        )

        self.assertEqual(
            len(filtered),
            1
        )

        self.assertEqual(

            filtered[0]["investigation_type"],

            "phishing"

        )

        self.assertNotIn(

            "analysis_json",

            filtered[0]

        )

        self.assertNotIn(

            "analysis",

            filtered[0]

        )


    def test_search_investigations(self):

        investigation = save_investigation(

            "logs",

            {

                "overall_risk": "Critical",

                "ip_analysis": [

                    {
                        "ip_address": "192.0.2.10"
                    }

                ],

            },

            db_path=self.db_path

        )

        save_investigation(

            "phishing",

            {"risk_level": "Low"},

            db_path=self.db_path

        )

        results = search_investigations(

            "192.0.2.10",

            db_path=self.db_path

        )

        self.assertEqual(
            len(results),
            1
        )

        self.assertEqual(

            results[0]["id"],

            investigation["id"]

        )


    def test_rename_investigation(self):

        investigation = save_investigation(

            "phishing",

            {"risk_level": "Medium"},

            db_path=self.db_path

        )

        updated = rename_investigation(

            investigation["id"],

            "Suspicious email review",

            db_path=self.db_path

        )

        retrieved = get_investigation(

            investigation["id"],

            db_path=self.db_path

        )

        self.assertTrue(updated)

        self.assertEqual(

            retrieved["title"],

            "Suspicious email review"

        )


    def test_delete_investigation(self):

        investigation = save_investigation(

            "anomaly",

            {"ml_anomalies": 1},

            db_path=self.db_path

        )

        deleted = delete_investigation(

            investigation["id"],

            db_path=self.db_path

        )

        self.assertTrue(deleted)

        self.assertIsNone(

            get_investigation(

                investigation["id"],

                db_path=self.db_path

            )

        )


    def test_investigation_statistics(self):

        save_investigation(

            "phishing",

            {"risk_level": "High"},

            ai_report="Security assessment.",

            db_path=self.db_path

        )

        save_investigation(

            "logs",

            {"overall_risk": "Critical"},

            db_path=self.db_path

        )

        save_investigation(

            "anomaly",

            {"ml_anomalies": 1},

            db_path=self.db_path

        )

        statistics = get_investigation_statistics(
            db_path=self.db_path
        )

        self.assertEqual(

            statistics["total_investigations"],

            3

        )

        self.assertEqual(

            statistics["phishing_investigations"],

            1

        )

        self.assertEqual(

            statistics["log_investigations"],

            1

        )

        self.assertEqual(

            statistics["anomaly_investigations"],

            1

        )

        self.assertEqual(

            statistics["ai_reports"],

            1

        )


# =========================================
# TEST RUNNER
# =========================================

if __name__ == "__main__":

    unittest.main(verbosity=2)
