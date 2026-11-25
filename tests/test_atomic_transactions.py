
import sqlite3
import tempfile
import unittest

from pathlib import Path

from database.db import (
    initialize_database,
    get_connection,
)

from database.conversations import (
    create_conversation,
    create_conversation_with_turn,
    save_chat_turn,
    get_conversation,
    get_messages,
    get_conversation_statistics,
)

from backend.schemas import ChatRequest

from backend.persistent_chat import (
    prepare_chat_session,
    complete_chat_session,
)


# =========================================
# ATOMIC TRANSACTION TESTS
# =========================================

class TestAtomicTransactions(unittest.TestCase):

    def setUp(self):

        self.temp_dir = tempfile.TemporaryDirectory()

        self.db_path = (
            Path(self.temp_dir.name)
            / "test_atomic.db"
        )

        initialize_database(
            self.db_path
        )

    def tearDown(self):

        self.temp_dir.cleanup()


    # =====================================
    # DATABASE FAILURE SIMULATION
    # =====================================

    def install_failure_trigger(self):

        with get_connection(
            self.db_path
        ) as connection:

            connection.execute("""
                CREATE TRIGGER simulate_message_failure

                BEFORE INSERT ON messages

                WHEN NEW.role = 'assistant'

                BEGIN

                    SELECT RAISE(
                        ABORT,
                        'Simulated database failure'
                    );

                END;
            """)


    # =====================================
    # SUCCESSFUL ATOMIC STORAGE
    # =====================================

    def test_atomic_creation_success(self):

        result = create_conversation_with_turn(

            user_message="Explain phishing.",

            assistant_message="Phishing is a cyber threat.",

            db_path=self.db_path,

        )

        self.assertEqual(
            result["messages_saved"], 2
        )

        conversation = get_conversation(

            result["conversation_id"],

            db_path=self.db_path,

        )

        self.assertIsNotNone(
            conversation
        )

        messages = get_messages(

            result["conversation_id"],

            db_path=self.db_path,

        )

        self.assertEqual(
            len(messages), 2
        )

        self.assertEqual(
            messages[0]["role"], "user"
        )

        self.assertEqual(
            messages[1]["role"], "assistant"
        )


    def test_automatic_title(self):

        result = create_conversation_with_turn(

            user_message="Explain brute force attacks",

            assistant_message="Repeated login attempts.",

            db_path=self.db_path,

        )

        self.assertEqual(

            result["title"],

            "Explain brute force attacks",

        )


    def test_custom_title(self):

        result = create_conversation_with_turn(

            user_message="Explain phishing.",

            assistant_message="A social engineering attack.",

            title="Security investigation",

            db_path=self.db_path,

        )

        self.assertEqual(

            result["title"],

            "Security investigation",

        )


    # =====================================
    # INPUT VALIDATION
    # =====================================

    def test_empty_user_message(self):

        with self.assertRaises(ValueError):

            create_conversation_with_turn(

                user_message="",

                assistant_message="Response",

                db_path=self.db_path,

            )

        stats = get_conversation_statistics(
            db_path=self.db_path
        )

        self.assertEqual(
            stats["total_conversations"], 0
        )

        self.assertEqual(
            stats["total_messages"], 0
        )


    def test_empty_assistant_message(self):

        with self.assertRaises(ValueError):

            create_conversation_with_turn(

                user_message="Hello",

                assistant_message="   ",

                db_path=self.db_path,

            )

        stats = get_conversation_statistics(
            db_path=self.db_path
        )

        self.assertEqual(
            stats["total_conversations"], 0
        )

        self.assertEqual(
            stats["total_messages"], 0
        )


    # =====================================
    # NEW CONVERSATION ROLLBACK
    # =====================================

    def test_failed_creation_rolls_back_everything(self):

        self.install_failure_trigger()

        with self.assertRaises(
            sqlite3.IntegrityError
        ):

            create_conversation_with_turn(

                user_message="Test user message",

                assistant_message="Test assistant response",

                db_path=self.db_path,

            )

        stats = get_conversation_statistics(
            db_path=self.db_path
        )

        self.assertEqual(
            stats["total_conversations"], 0
        )

        self.assertEqual(
            stats["total_messages"], 0
        )

        self.assertEqual(
            stats["user_messages"], 0
        )

        self.assertEqual(
            stats["assistant_messages"], 0
        )


    # =====================================
    # EXISTING CONVERSATION ROLLBACK
    # =====================================

    def test_existing_turn_rollback(self):

        conversation = create_conversation(

            title="Existing investigation",

            db_path=self.db_path,

        )

        conversation_id = conversation["id"]

        save_chat_turn(

            conversation_id=conversation_id,

            user_message="Original question",

            assistant_message="Original answer",

            db_path=self.db_path,

        )

        original_messages = get_messages(

            conversation_id,

            db_path=self.db_path,

        )

        self.install_failure_trigger()

        with self.assertRaises(
            sqlite3.IntegrityError
        ):

            save_chat_turn(

                conversation_id=conversation_id,

                user_message="Second question",

                assistant_message="Second answer",

                db_path=self.db_path,

            )

        messages = get_messages(

            conversation_id,

            db_path=self.db_path,

        )

        self.assertEqual(
            messages,
            original_messages,
        )

        self.assertEqual(
            len(messages), 2
        )


    # =====================================
    # PERSISTENT CHAT INTEGRATION
    # =====================================

    def test_persistent_chat_success(self):

        request = ChatRequest(

            message="What is cybersecurity?",

            save_history=True,

        )

        session = prepare_chat_session(

            request,

            db_path=self.db_path,

        )

        result = complete_chat_session(

            session,

            "Cybersecurity protects digital systems.",

        )

        self.assertTrue(
            result["history_saved"]
        )

        self.assertIsNotNone(
            result["conversation_id"]
        )

        self.assertEqual(

            session.conversation_id,

            result["conversation_id"],

        )

        stats = get_conversation_statistics(
            db_path=self.db_path
        )

        self.assertEqual(
            stats["total_conversations"], 1
        )

        self.assertEqual(
            stats["total_messages"], 2
        )


    def test_failed_chat_returns_no_uncommitted_id(self):

        self.install_failure_trigger()

        request = ChatRequest(

            message="Test storage failure",

            save_history=True,

        )

        session = prepare_chat_session(

            request,

            db_path=self.db_path,

        )

        result = complete_chat_session(

            session,

            "Generated AI response",

        )

        self.assertFalse(
            result["history_saved"]
        )

        self.assertIsNone(
            result["conversation_id"]
        )

        self.assertIsNone(
            session.conversation_id
        )

        self.assertIsNotNone(
            result["storage_warning"]
        )

        stats = get_conversation_statistics(
            db_path=self.db_path
        )

        self.assertEqual(
            stats["total_conversations"], 0
        )

        self.assertEqual(
            stats["total_messages"], 0
        )


    # =====================================
    # TEMPORARY CHAT PRIVACY
    # =====================================

    def test_temporary_chat_never_saved(self):

        request = ChatRequest(

            message="Private temporary message",

            save_history=False,

        )

        session = prepare_chat_session(

            request,

            db_path=self.db_path,

        )

        result = complete_chat_session(

            session,

            "Temporary AI response",

        )

        self.assertFalse(
            result["history_saved"]
        )

        stats = get_conversation_statistics(
            db_path=self.db_path
        )

        self.assertEqual(
            stats["total_conversations"], 0
        )

        self.assertEqual(
            stats["total_messages"], 0
        )


    # =====================================
    # DATABASE INTEGRITY AFTER FAILURE
    # =====================================

    def test_database_integrity_after_rollback(self):

        self.install_failure_trigger()

        with self.assertRaises(
            sqlite3.IntegrityError
        ):

            create_conversation_with_turn(

                user_message="Test question",

                assistant_message="Test response",

                db_path=self.db_path,

            )

        with get_connection(
            self.db_path
        ) as connection:

            integrity = connection.execute(

                "PRAGMA integrity_check"

            ).fetchone()[0]

            foreign_key_errors = connection.execute(

                "PRAGMA foreign_key_check"

            ).fetchall()

        self.assertEqual(
            integrity, "ok"
        )

        self.assertEqual(
            len(foreign_key_errors), 0
        )


if __name__ == "__main__":

    unittest.main()
