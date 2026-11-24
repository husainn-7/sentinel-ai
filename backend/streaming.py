
import json
import logging

import ollama

from backend.ai_service import (
    MODEL,
    build_chat_messages,
)

from backend.persistent_chat import (
    ChatSession,
    complete_chat_session,
)


# =========================================
# CONFIGURATION
# =========================================

logger = logging.getLogger(__name__)


# =========================================
# SERVER-SENT EVENT FORMATTER
# =========================================

def format_event(data):

    return (

        f"data: {json.dumps(data, ensure_ascii=False)}"

        "\n\n"

    )


# =========================================
# STREAMING CHAT RESPONSE
# =========================================

def stream_chat_response(
    message,
    history=None,
    session: ChatSession | None = None
):

    response_parts = []

    completed = False

    stream = None

    try:

        messages = build_chat_messages(

            message,

            history,

        )

        stream = ollama.chat(

            model=MODEL,

            messages=messages,

            stream=True,

            options={

                "temperature": 0.3,

                "num_predict": 500,

            },

        )

        for chunk in stream:

            message_data = chunk.get(

                "message",

                {},

            )

            content = message_data.get(

                "content",

                "",

            )

            if content:

                response_parts.append(
                    content
                )

                yield format_event({

                    "type": "token",

                    "content": content,

                })

            if chunk.get("done", False):

                completed = True


        # Do not save an interrupted or
        # incomplete model response.

        if not completed:

            yield format_event({

                "type": "error",

                "message": (
                    "AI response ended unexpectedly."
                ),

            })

            return


        full_response = "".join(
            response_parts
        )


        # Persistent chat sessions return
        # storage metadata before completion.

        if (
            session is not None
            and session.save_history
        ):

            storage_metadata = complete_chat_session(

                session,

                full_response,

            )

            yield format_event({

                "type": "history",

                **storage_metadata,

            })


        # Preserve compatibility with our
        # existing frontend and API tests.

        yield format_event({

            "type": "done",

        })


    except GeneratorExit:

        # The streaming consumer disconnected.
        # Do not attempt additional writes.

        raise


    except Exception as exception:

        logger.warning(

            "AI streaming failed: %s",

            type(exception).__name__,

        )

        yield format_event({

            "type": "error",

            "message": (
                "AI service unavailable. "
                "Check Ollama."
            ),

        })


    finally:

        # Release the underlying stream
        # when supported by the client.

        if stream is not None:

            close_stream = getattr(

                stream,

                "close",

                None,

            )

            if callable(close_stream):

                try:

                    close_stream()

                except Exception:

                    logger.warning(
                        "AI stream cleanup failed."
                    )
