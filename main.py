import json
import ollama

from pathlib import Path
from security.risk_engine import analyze_email


MODEL = "llama3.2:latest"
MAX_HISTORY = 6

BASE_DIR = Path(__file__).resolve().parent

SYSTEM_PROMPT = (
    BASE_DIR / "prompts" / "system_prompt.txt"
).read_text(encoding="utf-8")

PHISHING_PROMPT = (
    BASE_DIR / "prompts" / "phishing_prompt.txt"
).read_text(encoding="utf-8")

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
        options={"temperature": 0.3}
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


def phishing_analysis():

    print("\n--- PHISHING ANALYSIS MODE ---")

    print("Paste the suspicious email below.")
    print("Remove passwords and personal details.")
    print("Type END on a separate line to analyse.\n")

    lines = []

    while True:

        line = input()

        if line.strip() == "END":
            break

        lines.append(line)

    email_text = "\n".join(lines)

    if not email_text.strip():
        print("No email content provided.\n")
        return

    # Run deterministic security analysis
    result = analyze_email(email_text)

    print("\n" + "=" * 50)
    print("PHISHING ANALYSIS RESULTS")
    print("=" * 50)

    print(f"Risk Score: {result['risk_score']}/100")
    print(f"Risk Level: {result['risk_level']}")

    print("\nKeyword Indicators:")

    for category, matches in result[
        "keyword_indicators"
    ].items():

        print(f"{category}: {matches}")

    print("\nURL Analysis:")

    for url in result["url_analysis"]:

        print(f"URL: {url['url']}")
        print(f"Indicators: {url['indicators']}")

    print("\nGenerating AI security report...\n")

    # Send structured findings to the AI
    response = ollama.chat(
        model=MODEL,
        messages=[
            {
                "role": "system",
                "content": PHISHING_PROMPT
            },
            {
                "role": "user",
                "content": json.dumps(result, indent=2)
            }
        ],
        options={"temperature": 0.2}
    )

    print(response["message"]["content"])
    print("\n" + "=" * 50 + "\n")


def main():

    print("=" * 50)
    print("SENTINEL AI - Cybersecurity Assistant")
    print("=" * 50)

    print("Model:", MODEL)
    print("Conversational memory: Enabled")
    print("Phishing analysis: Enabled")

    print("\nAvailable commands:")
    print("/phishing - Analyse suspicious emails")
    print("clear     - Reset conversation memory")
    print("exit      - Exit Sentinel AI\n")

    while True:

        user_input = input("You: ").strip()

        if user_input.lower() == "exit":

            print("Sentinel: Stay safe. Goodbye!")
            break

        if user_input.lower() == "clear":

            conversation_history.clear()
            print("Sentinel: Memory cleared.\n")
            continue

        if not user_input:
            continue

        try:

            if user_input.lower() == "/phishing":

                phishing_analysis()
                continue

            print("\nSentinel is thinking...\n")

            response = generate_response(user_input)

            print(f"Sentinel: {response}\n")

        except Exception as error:

            print(f"Error: {error}\n")


if __name__ == "__main__":
    main()