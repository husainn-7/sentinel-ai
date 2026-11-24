
import json
import ollama

from backend.ai_service import MODEL, build_chat_messages


# ==============================
# CONTEXT-AWARE STREAMING SERVICE
# ==============================

def stream_chat_response(message, history=None):

    try:

        messages = build_chat_messages(
            message,
            history
        )

        stream = ollama.chat(
            model=MODEL,
            messages=messages,
            stream=True,
            options={
                "temperature": 0.3,
                "num_predict": 500
            }
        )

        for chunk in stream:

            content = chunk["message"]["content"]

            if content:

                event = {
                    "type": "token",
                    "content": content
                }

                yield f"data: {json.dumps(event)}\n\n"

        yield 'data: {"type": "done"}\n\n'

    except Exception:

        event = {
            "type": "error",
            "message": "AI service unavailable. Check Ollama."
        }

        yield f"data: {json.dumps(event)}\n\n"
