
import json
import unittest

from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from uuid import uuid4

from fastapi.testclient import TestClient

from backend.api import app

from backend.schemas import ChatRequest

from backend.history_router import (
    get_database_path,
)

from backend.persistent_chat import (
    prepare_chat_session,
    complete_chat_session,
    ConversationNotFoundError,
    InvalidConversationRequestError,
)

from backend.streaming import (
    stream_chat_response,
)

from database.db import (
    initialize_database,
)

from database.conversations import (
    create_conversation,
    get_conversation,
    get_messages,
    save_chat_turn,
    get_conversation_statistics,
)


# =========================================
# ISOLATED DATABASE FOUNDATION
# =========================================

class PersistentChatTestCase(unittest.TestCase):

    def setUp(self):

        self.temp_directory = TemporaryDirectory()

        self.addCleanup(
            self.temp_directory.cleanup
        )

        self.db_path = (
            Path(self.temp_directory.name)
            / "test_persistent_chat.db"
        )

        initialize_database(self.db_path)


    def create_saved_conversation(self):

        conversation = create_conversation(
            db_path=self.db_path
        )

        save_chat_turn(

            conversation["id"],

            "My favourite colour is blue.",

            "Understood.",

            db_path=self.db_path,

        )

        return conversation


    def parse_events(self, stream):

        events = []

        for event in stream:

            for line in event.splitlines():

                if line.startswith("data: "):

                    events.append(
                        json.loads(line[6:])
                    )

        return events


# =========================================
# PERSISTENT CHAT SERVICE TESTS
# =========================================

class TestPersistentChatService(
    PersistentChatTestCase
):

    def test_temporary_chat_preparation(self):

        request = ChatRequest(

            message="Hello Sentinel.",

            history=[
                {
                    "role": "user",
                    "content": "Previous message.",
                }
            ],

        )

        session = prepare_chat_session(

            request,

            db_path=self.db_path,

        )

        self.assertFalse(
            session.save_history
        )

        self.assertIsNone(
            session.conversation_id
        )

        self.assertEqual(
            len(session.history),
            1
        )


    def test_temporary_chat_does_not_save(self):

        session = prepare_chat_session(

            ChatRequest(message="Hello."),

            db_path=self.db_path,

        )

        metadata = complete_chat_session(

            session,

            "Hello. How can I help?",

        )

        self.assertFalse(
            metadata["history_saved"]
        )

        statistics = get_conversation_statistics(
            db_path=self.db_path
        )

        self.assertEqual(
            statistics["total_conversations"],
            0
        )

        self.assertEqual(
            statistics["total_messages"],
            0
        )


    def test_new_persistent_session_starts_empty(self):

        request = ChatRequest(

            message="Hello.",

            save_history=True,

        )

        session = prepare_chat_session(

            request,

            db_path=self.db_path,

        )

        self.assertTrue(
            session.save_history
        )

        self.assertIsNone(
            session.conversation_id
        )

        self.assertEqual(
            session.history,
            []
        )

        statistics = get_conversation_statistics(
            db_path=self.db_path
        )

        self.assertEqual(
            statistics["total_conversations"],
            0
        )


    def test_save_new_persistent_conversation(self):

        session = prepare_chat_session(

            ChatRequest(

                message="Explain phishing.",

                save_history=True,

            ),

            db_path=self.db_path,

        )

        metadata = complete_chat_session(

            session,

            "Phishing is a deceptive technique.",

        )

        self.assertTrue(
            metadata["history_saved"]
        )

        conversation_id = metadata[
            "conversation_id"
        ]

        self.assertIsNotNone(
            conversation_id
        )

        messages = get_messages(

            conversation_id,

            db_path=self.db_path,

        )

        self.assertEqual(
            len(messages),
            2
        )

        self.assertEqual(
            messages[0]["content"],
            "Explain phishing."
        )

        self.assertEqual(
            messages[1]["role"],
            "assistant"
        )


    def test_existing_conversation_retrieves_context(self):

        conversation = (
            self.create_saved_conversation()
        )

        session = prepare_chat_session(

            ChatRequest(

                message="What is my favourite colour?",

                conversation_id=conversation["id"],

                save_history=True,

            ),

            db_path=self.db_path,

        )

        self.assertEqual(
            len(session.history),
            2
        )

        self.assertEqual(

            session.history[0]["content"],

            "My favourite colour is blue."

        )


    def test_server_history_overrides_client_history(self):

        conversation = (
            self.create_saved_conversation()
        )

        session = prepare_chat_session(

            ChatRequest(

                message="What is my favourite colour?",

                conversation_id=conversation["id"],

                save_history=True,

                history=[
                    {
                        "role": "user",
                        "content": "My colour is red.",
                    }
                ],

            ),

            db_path=self.db_path,

        )

        contents = [

            message["content"]

            for message in session.history

        ]

        self.assertIn(

            "My favourite colour is blue.",

            contents,

        )

        self.assertNotIn(

            "My colour is red.",

            contents,

        )


    def test_append_to_existing_conversation(self):

        conversation = (
            self.create_saved_conversation()
        )

        conversation_id = conversation["id"]

        session = prepare_chat_session(

            ChatRequest(

                message="What is my favourite colour?",

                conversation_id=conversation_id,

                save_history=True,

            ),

            db_path=self.db_path,

        )

        metadata = complete_chat_session(

            session,

            "Blue.",

        )

        self.assertTrue(
            metadata["history_saved"]
        )

        self.assertEqual(

            metadata["conversation_id"],

            conversation_id,

        )

        messages = get_messages(

            conversation_id,

            db_path=self.db_path,

        )

        self.assertEqual(
            len(messages),
            4
        )

        self.assertEqual(
            messages[-1]["content"],
            "Blue."
        )


    def test_missing_conversation_rejected(self):

        request = ChatRequest(

            message="Hello.",

            conversation_id=str(uuid4()),

            save_history=True,

        )

        with self.assertRaises(
            ConversationNotFoundError
        ):

            prepare_chat_session(

                request,

                db_path=self.db_path,

            )


    def test_temporary_chat_with_saved_id_rejected(self):

        request = ChatRequest(

            message="Hello.",

            conversation_id=str(uuid4()),

            save_history=False,

        )

        with self.assertRaises(
            InvalidConversationRequestError
        ):

            prepare_chat_session(

                request,

                db_path=self.db_path,

            )


    def test_empty_response_is_not_saved(self):

        session = prepare_chat_session(

            ChatRequest(

                message="Hello.",

                save_history=True,

            ),

            db_path=self.db_path,

        )

        metadata = complete_chat_session(

            session,

            "   ",

        )

        self.assertFalse(
            metadata["history_saved"]
        )

        self.assertIsNotNone(
            metadata["storage_warning"]
        )

        statistics = get_conversation_statistics(
            db_path=self.db_path
        )

        self.assertEqual(
            statistics["total_conversations"],
            0
        )


    def test_storage_failure_returns_warning(self):

        conversation = (
            self.create_saved_conversation()
        )

        session = prepare_chat_session(

            ChatRequest(

                message="Hello again.",

                conversation_id=conversation["id"],

                save_history=True,

            ),

            db_path=self.db_path,

        )

        with patch(

            "backend.persistent_chat.save_chat_turn",

            side_effect=RuntimeError(
                "Simulated storage failure"
            ),

        ):

            metadata = complete_chat_session(

                session,

                "Hello.",

            )

        self.assertFalse(
            metadata["history_saved"]
        )

        self.assertIsNotNone(
            metadata["storage_warning"]
        )

        messages = get_messages(

            conversation["id"],

            db_path=self.db_path,

        )

        self.assertEqual(
            len(messages),
            2
        )


# =========================================
# STREAMING PERSISTENCE TESTS
# =========================================

class TestPersistentStreaming(
    PersistentChatTestCase
):

    def make_session(self):

        return prepare_chat_session(

            ChatRequest(

                message="Explain phishing.",

                save_history=True,

            ),

            db_path=self.db_path,

        )


    def test_completed_stream_saves_history(self):

        session = self.make_session()

        chunks = [

            {
                "message": {
                    "content": "Phishing"
                },
                "done": False,
            },

            {
                "message": {
                    "content": " is deceptive."
                },
                "done": False,
            },

            {
                "message": {
                    "content": ""
                },
                "done": True,
            },

        ]

        with patch(

            "backend.streaming.ollama.chat",

            return_value=iter(chunks),

        ):

            events = self.parse_events(

                stream_chat_response(

                    session.message,

                    session.history,

                    session=session,

                )

            )

        event_types = [

            event["type"]

            for event in events

        ]

        self.assertEqual(

            event_types,

            ["token", "token", "history", "done"]

        )

        metadata = events[-2]

        self.assertTrue(
            metadata["history_saved"]
        )

        messages = get_messages(

            metadata["conversation_id"],

            db_path=self.db_path,

        )

        self.assertEqual(

            messages[-1]["content"],

            "Phishing is deceptive."

        )


    def test_incomplete_stream_is_not_saved(self):

        session = self.make_session()

        chunks = [

            {
                "message": {
                    "content": "Partial response"
                },
                "done": False,
            },

        ]

        with patch(

            "backend.streaming.ollama.chat",

            return_value=iter(chunks),

        ):

            events = self.parse_events(

                stream_chat_response(

                    session.message,

                    session.history,

                    session=session,

                )

            )

        self.assertEqual(
            events[-1]["type"],
            "error"
        )

        statistics = get_conversation_statistics(
            db_path=self.db_path
        )

        self.assertEqual(
            statistics["total_messages"],
            0
        )


    def test_ai_stream_failure_is_not_saved(self):

        session = self.make_session()

        with patch(

            "backend.streaming.ollama.chat",

            side_effect=RuntimeError(
                "Simulated Ollama failure"
            ),

        ):

            events = self.parse_events(

                stream_chat_response(

                    session.message,

                    session.history,

                    session=session,

                )

            )

        self.assertEqual(
            events[-1]["type"],
            "error"
        )

        statistics = get_conversation_statistics(
            db_path=self.db_path
        )

        self.assertEqual(
            statistics["total_conversations"],
            0
        )


    def test_temporary_stream_does_not_save(self):

        session = prepare_chat_session(

            ChatRequest(
                message="Hello."
            ),

            db_path=self.db_path,

        )

        chunks = [

            {
                "message": {
                    "content": "Hello."
                },
                "done": False,
            },

            {
                "message": {
                    "content": ""
                },
                "done": True,
            },

        ]

        with patch(

            "backend.streaming.ollama.chat",

            return_value=iter(chunks),

        ):

            events = self.parse_events(

                stream_chat_response(

                    session.message,

                    session.history,

                    session=session,

                )

            )

        self.assertEqual(

            [event["type"] for event in events],

            ["token", "done"]

        )

        statistics = get_conversation_statistics(
            db_path=self.db_path
        )

        self.assertEqual(
            statistics["total_messages"],
            0
        )


# =========================================
# PERSISTENT CHAT API INTEGRATION TESTS
# =========================================

class TestPersistentChatAPI(
    PersistentChatTestCase
):

    def setUp(self):

        super().setUp()

        previous_overrides = (
            app.dependency_overrides.copy()
        )

        self.addCleanup(
            self.restore_overrides,
            previous_overrides,
        )

        app.dependency_overrides[
            get_database_path
        ] = lambda: self.db_path

        self.client = TestClient(app, base_url="http://127.0.0.1:8000")

        self.client.__enter__()

        self.addCleanup(

            self.client.__exit__,

            None,

            None,

            None,

        )


    def restore_overrides(self, overrides):

        app.dependency_overrides.clear()

        app.dependency_overrides.update(
            overrides
        )


    def test_persistent_chat_api_saves_response(self):

        with patch(

            "backend.api.chat",

            return_value="Hello. I am Sentinel.",

        ):

            response = self.client.post(

                "/chat",

                json={

                    "message": "Hello Sentinel.",

                    "save_history": True,

                },

            )

        self.assertEqual(
            response.status_code,
            200
        )

        data = response.json()

        self.assertTrue(
            data["history_saved"]
        )

        conversation_id = data[
            "conversation_id"
        ]

        retrieved = self.client.get(

            f"/history/conversations/{conversation_id}"

        )

        self.assertEqual(
            retrieved.status_code,
            200
        )

        self.assertEqual(

            len(retrieved.json()["messages"]),

            2,

        )


    def test_persistent_chat_api_uses_saved_context(self):

        conversation = (
            self.create_saved_conversation()
        )

        with patch(

            "backend.api.chat",

            return_value="Blue.",

        ) as mock_chat:

            response = self.client.post(

                "/chat",

                json={

                    "message": "What is my favourite colour?",

                    "conversation_id": conversation["id"],

                    "save_history": True,

                },

            )

        self.assertEqual(
            response.status_code,
            200
        )

        self.assertTrue(

            response.json()["history_saved"]

        )

        passed_history = mock_chat.call_args.args[1]

        self.assertEqual(

            passed_history[0]["content"],

            "My favourite colour is blue."

        )


    def test_missing_saved_conversation_returns_404(self):

        response = self.client.post(

            "/chat",

            json={

                "message": "Hello.",

                "conversation_id": str(uuid4()),

                "save_history": True,

            },

        )

        self.assertEqual(
            response.status_code,
            404
        )


    def test_invalid_conversation_uuid_returns_422(self):

        response = self.client.post(

            "/chat",

            json={

                "message": "Hello.",

                "conversation_id": "invalid-uuid",

                "save_history": True,

            },

        )

        self.assertEqual(
            response.status_code,
            422
        )


    def test_persistent_stream_api_saves_response(self):

        chunks = [

            {
                "message": {
                    "content": "Hello Sentinel user."
                },
                "done": False,
            },

            {
                "message": {
                    "content": ""
                },
                "done": True,
            },

        ]

        with patch(

            "backend.streaming.ollama.chat",

            return_value=iter(chunks),

        ):

            response = self.client.post(

                "/chat/stream",

                json={

                    "message": "Hello.",

                    "save_history": True,

                },

            )

        self.assertEqual(
            response.status_code,
            200
        )

        events = self.parse_events(
            [response.text]
        )

        self.assertEqual(
            events[-1]["type"],
            "done"
        )

        metadata = next(

            event

            for event in events

            if event["type"] == "history"

        )

        self.assertTrue(
            metadata["history_saved"]
        )

        messages = get_messages(

            metadata["conversation_id"],

            db_path=self.db_path,

        )

        self.assertEqual(
            len(messages),
            2
        )


# =========================================
# TEST RUNNER
# =========================================

if __name__ == "__main__":

    unittest.main(verbosity=2)
