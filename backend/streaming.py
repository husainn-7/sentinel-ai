import json
import ollama

from backend.ai_service import MODEL, SYSTEM_PROMPT


def stream_chat_response(message):

    try:

        stream = ollama.chat(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": SYSTEM_PROMPT
                },
                {
                    "role": "user",
                    "content": message
                }
            ],
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