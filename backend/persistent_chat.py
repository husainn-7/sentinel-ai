
import logging

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from backend.schemas import ChatRequest

from database.conversations import (
    create_conversation,
    get_conversation,
    get_recent_context,
    save_chat_turn,
)


# =========================================
# CONFIGURATION
# =========================================

logger = logging.getLogger(__name__)

MAX_CONTEXT_MESSAGES = 6

MAX_CONTEXT_CHARACTERS = 6000


# =========================================
# CUSTOM EXCEPTIONS
# =========================================

class ConversationNotFoundError(Exception):

    pass


class InvalidConversationRequestError(Exception):

    pass


# =========================================
# CHAT SESSION
# =========================================

@dataclass
class ChatSession:

    message: str

    history: list[dict[str, str]]

    conversation_id: str | None

    save_history: bool

    db_path: Path | str | None = None


# =========================================
# PREPARE CHAT SESSION
# =========================================

def prepare_chat_session(
    request: ChatRequest,
    db_path=None
):

    conversation_id = (

        str(request.conversation_id)

        if request.conversation_id is not None

        else None

    )


    # Temporary conversations use the history
    # supplied by the frontend.
    # Nothing is written to SQLite.

    if not request.save_history:

        if conversation_id is not None:

            raise InvalidConversationRequestError(

                "Temporary chat cannot use "
                "a saved conversation ID."

            )

        return ChatSession(

            message=request.message,

            history=[

                message.model_dump()

                for message in request.history

            ],

            conversation_id=None,

            save_history=False,

            db_path=db_path,

        )


    # Persistent conversations use SQLite
    # as the authoritative source of context.

    if conversation_id is not None:

        conversation = get_conversation(

            conversation_id,

            db_path=db_path,

        )

        if conversation is None:

            raise ConversationNotFoundError(

                "Saved conversation not found."

            )

        history = get_recent_context(

            conversation_id,

            max_messages=MAX_CONTEXT_MESSAGES,

            max_characters=MAX_CONTEXT_CHARACTERS,

            db_path=db_path,

        )

    else:

        # A new persistent conversation starts
        # with no previous saved messages.
        #
        # The database record is created only
        # after a complete response is generated.

        history = []


    return ChatSession(

        message=request.message,

        history=history,

        conversation_id=conversation_id,

        save_history=True,

        db_path=db_path,

    )


# =========================================
# RESPONSE STORAGE METADATA
# =========================================

def build_storage_metadata(
    conversation_id=None,
    history_saved=False,
    storage_warning=None
):

    return {

        "conversation_id": conversation_id,

        "history_saved": history_saved,

        "storage_warning": storage_warning,

    }


# =========================================
# SAVE COMPLETED CHAT SESSION
# =========================================

def complete_chat_session(
    session: ChatSession,
    assistant_response: str
) -> dict[str, Any]:

    # Temporary chats are never persisted.

    if not session.save_history:

        return build_storage_metadata()


    if (
        not isinstance(assistant_response, str)
        or not assistant_response.strip()
    ):

        return build_storage_metadata(

            conversation_id=session.conversation_id,

            history_saved=False,

            storage_warning=(
                "Empty assistant responses "
                "cannot be saved."
            ),

        )


    conversation_id = session.conversation_id


    try:

        # Create a database record only when
        # the first complete response exists.

        if conversation_id is None:

            conversation = create_conversation(

                db_path=session.db_path

            )

            conversation_id = conversation["id"]


        # Save the user message and assistant
        # response together in one transaction.

        save_chat_turn(

            conversation_id=conversation_id,

            user_message=session.message,

            assistant_message=assistant_response,

            db_path=session.db_path,

        )

        session.conversation_id = conversation_id

        return build_storage_metadata(

            conversation_id=conversation_id,

            history_saved=True,

        )


    except Exception as exception:

        # Log only the exception type.
        # Do not log potentially sensitive
        # conversation content.

        logger.warning(

            "Conversation storage failed: %s",

            type(exception).__name__,

        )

        return build_storage_metadata(

            conversation_id=conversation_id,

            history_saved=False,

            storage_warning=(

                "The AI response was generated, "

                "but conversation history "

                "could not be saved."

            ),

        )
