import ollama
from pathlib import Path

MODEL = "llama3.2:latest"
MAX_HISTORY = 6

BASE_DIR = Path(__file__).resolve().parent

PROMPT_PATH = BASE_DIR / "prompts" / "system_prompt.txt"

SYSTEM_PROMPT = PROMPT_PATH.read_text(encoding="utf-8")

conversation_history = []


def generate_response(user_input):

    messages = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT
        }
    ]

    messages.extend(conversation_history)

    messages.append({
        "role": "user",
        "content": user_input
    })

    response = ollama.chat(
        model=MODEL,
        messages=messages,
        options={
            "temperature": 0.3
        }
    )

    assistant_reply = response["message"]["content"]

    conversation_history.append({
        "role": "user",
        "content": user_input
    })

    conversation_history.append({
        "role": "assistant",
        "content": assistant_reply
    })

    if len(conversation_history) > MAX_HISTORY:
        del conversation_history[:-MAX_HISTORY]

    return assistant_reply


def main():
    print("=" * 50)
    print("SENTINEL AI - Cybersecurity Assistant")
    print("=" * 50)
    print("Model:", MODEL)
    print("System prompt: Loaded")
    print("Conversational memory: Enabled")
    print("Type 'exit' to end the conversation.")
    print("Type 'clear' to reset memory.\n")

    while True:
        user_input = input("You: ").strip()

        if user_input.lower() == "exit":
            print("Sentinel: Stay safe. Goodbye!")
            break

        if user_input.lower() == "clear":
            conversation_history.clear()
            print("Sentinel: Conversation memory cleared.\n")
            continue

        if not user_input:
            continue

        try:
            print("\nSentinel is thinking...\n")

            response = generate_response(user_input)

            print(f"Sentinel: {response}\n")

        except Exception as error:
            print(f"Error: {error}\n")


if __name__ == "__main__":
    main()