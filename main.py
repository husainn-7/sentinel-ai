import json
import ollama

from pathlib import Path

from security.risk_engine import analyze_email
from security.log_engine import analyze_security_logs
from ml.predict_anomaly import predict_anomalies


# ==============================
# CONFIGURATION
# ==============================

MODEL = "llama3.2:latest"

MAX_HISTORY = 6

BASE_DIR = Path(__file__).resolve().parent


# ==============================
# SYSTEM PROMPTS
# ==============================

SYSTEM_PROMPT = (
    BASE_DIR / "prompts" / "system_prompt.txt"
).read_text(encoding="utf-8")

PHISHING_PROMPT = (
    BASE_DIR / "prompts" / "phishing_prompt.txt"
).read_text(encoding="utf-8")

LOG_PROMPT = (
    BASE_DIR / "prompts" / "log_prompt.txt"
).read_text(encoding="utf-8")

ANOMALY_PROMPT = (
    BASE_DIR / "prompts" / "anomaly_prompt.txt"
).read_text(encoding="utf-8")


# ==============================
# CONVERSATION MEMORY
# ==============================

conversation_history = []


# ==============================
# STREAMING RESPONSE ENGINE
# ==============================

def stream_response(
    messages,
    temperature=0.2,
    max_tokens=300
):

    stream = ollama.chat(
        model=MODEL,
        messages=messages,
        stream=True,
        options={
            "temperature": temperature,
            "num_predict": max_tokens
        }
    )

    full_response = []

    for chunk in stream:

        content = chunk["message"]["content"]

        print(content, end="", flush=True)

        full_response.append(content)

    print()

    return "".join(full_response)


# ==============================
# GENERAL AI RESPONSE
# ==============================

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

    print("\nSentinel: ", end="", flush=True)

    response = stream_response(
        messages,
        temperature=0.3,
        max_tokens=500
    )

    conversation_history.append({
        "role": "user",
        "content": user_input
    })

    conversation_history.append({
        "role": "assistant",
        "content": response
    })

    if len(conversation_history) > MAX_HISTORY:

        del conversation_history[:-MAX_HISTORY]


# ==============================
# MULTILINE INPUT
# ==============================

def read_multiline_input():

    lines = []

    print("Paste your data below.")
    print("Type END on a new line when finished.\n")

    while True:

        line = input()

        if line.strip() == "END":

            break

        lines.append(line)

    return "\n".join(lines)


# ==============================
# AI SECURITY REPORT
# ==============================

def generate_security_report(
    prompt,
    data,
    max_tokens=300
):

    messages = [
        {
            "role": "system",
            "content": prompt
        },
        {
            "role": "user",
            "content": json.dumps(data, indent=2)
        }
    ]

    return stream_response(
        messages,
        temperature=0.1,
        max_tokens=max_tokens
    )


# ==============================
# PHISHING ANALYSIS
# ==============================

def phishing_analysis():

    print("\n" + "=" * 60)
    print("SENTINEL AI - PHISHING ANALYSIS")
    print("=" * 60)

    email_text = read_multiline_input()

    if not email_text.strip():

        print("No email content provided.")
        return

    result = analyze_email(email_text)

    print("\nPHISHING DETECTION RESULTS")
    print("=" * 60)

    print(
        "Risk Score:",
        result["risk_score"],
        "/ 100"
    )

    print("Risk Level:", result["risk_level"])

    print("\nKeyword Indicators:")

    print(
        json.dumps(
            result["keyword_indicators"],
            indent=4
        )
    )

    print("\nURL Analysis:")

    print(
        json.dumps(
            result["url_analysis"],
            indent=4
        )
    )

    print("\nAI PHISHING REPORT")
    print("=" * 60)

    generate_security_report(
        PHISHING_PROMPT,
        result
    )


# ==============================
# SECURITY LOG ANALYSIS
# ==============================

def log_analysis():

    print("\n" + "=" * 60)
    print("SENTINEL AI - SECURITY LOG ANALYSIS")
    print("=" * 60)

    log_text = read_multiline_input()

    if not log_text.strip():

        print("No security logs provided.")
        return

    result = analyze_security_logs(log_text)

    print("\nSECURITY LOG ANALYSIS RESULTS")
    print("=" * 60)

    print(json.dumps(result, indent=4))

    if result["summary"]["total_events"] == 0:

        print("No valid authentication events found.")
        return

    print("\nAI INCIDENT REPORT")
    print("=" * 60)

    generate_security_report(
        LOG_PROMPT,
        result
    )


# ==============================
# DETERMINISTIC ANOMALY REPORT
# ==============================

def generate_factual_report(result):

    print("\nFACTUAL DETECTION REPORT")
    print("=" * 60)

    print(
        "Authentication windows:",
        result["total_windows"]
    )

    print(
        "ML anomalies:",
        result["ml_anomalies"]
    )

    print(
        "Rule-based alerts:",
        result["rule_alerts"]
    )

    for record in result["results"]:

        print("\n" + "-" * 60)

        print("IP Address:", record["ip_address"])

        print(
            "Window:",
            record["window_start"]
        )

        print(
            "Failed attempts:",
            record["failed_attempts"]
        )

        print(
            "Successful attempts:",
            record["successful_attempts"]
        )

        print(
            "Failure rate:",
            f'{record["failure_rate"]:.2%}'
        )

        print(
            "Decision score:",
            f'{record["decision_score"]:+.6f}'
        )

        if record["ml_anomaly"]:

            print("ML classification: Anomaly")

        else:

            print("ML classification: No anomaly")

        if record["rule_alert"]:

            print("Rule classification: Alert")

        else:

            print("Rule classification: No alert")

        print(
            "Assessment:",
            record["assessment"]
        )

    print("\nDetection limitations:")

    print(
        "- The ML model was trained on synthetic data."
    )

    print(
        "- Decision scores are not attack probabilities."
    )

    print(
        "- Alerts do not confirm malicious intent."
    )

    print(
        "- No alert does not guarantee safe activity."
    )


# ==============================
# PREPARE AI ADVISORY DATA
# ==============================

def prepare_advisory_data(result):

    findings = []

    for record in result["results"]:

        findings.append({
            "ip_address": record["ip_address"],

            "failed_attempts":
                record["failed_attempts"],

            "successful_attempts":
                record["successful_attempts"],

            "ml_finding": (
                "Anomaly detected"
                if record["ml_anomaly"]
                else "No anomaly detected"
            ),

            "rule_finding": (
                "Rule alert triggered"
                if record["rule_alert"]
                else "No rule alert"
            ),

            "assessment": record["assessment"]
        })

    return {
        "total_windows": result["total_windows"],

        "ml_anomalies": result["ml_anomalies"],

        "rule_alerts": result["rule_alerts"],

        "findings": findings
    }


# ==============================
# ML ANOMALY ANALYSIS
# ==============================

def anomaly_analysis():

    print("\n" + "=" * 60)
    print("SENTINEL AI - ML ANOMALY DETECTION")
    print("=" * 60)

    print("Model: Isolation Forest")
    print("Observation window: 60 seconds\n")

    log_text = read_multiline_input()

    if not log_text.strip():

        print("No authentication logs provided.")
        return

    result = predict_anomalies(log_text)

    if result["total_windows"] == 0:

        print("No valid authentication windows found.")
        return

    # Authoritative Python-generated findings

    generate_factual_report(result)

    # Simplified findings for the LLM

    advisory_data = prepare_advisory_data(result)

    print("\nAI SECURITY ADVISORY")
    print("=" * 60)

    print("AI-generated advice; verify before acting.\n")

    generate_security_report(
        ANOMALY_PROMPT,
        advisory_data,
        max_tokens=220
    )


# ==============================
# APPLICATION BANNER
# ==============================

def display_banner():

    print("=" * 60)
    print("                    SENTINEL AI")
    print("           Intelligent Cybersecurity Assistant")
    print("                    Version 0.4")
    print("=" * 60)

    print("\nLocal AI Model:", MODEL)
    print("Conversation Memory: Enabled")
    print("Response Streaming: Enabled")
    print("Phishing Detection: Enabled")
    print("Security Log Analysis: Enabled")
    print("ML Anomaly Detection: Enabled")

    print("\nAVAILABLE COMMANDS")
    print("-" * 60)

    print("/phishing  - Analyse suspicious emails")
    print("/logs      - Analyse SSH security logs")
    print("/anomaly   - Detect authentication anomalies")
    print("clear      - Clear conversation history")
    print("exit       - Exit Sentinel AI")

    print("=" * 60)


# ==============================
# MAIN APPLICATION
# ==============================

def main():

    display_banner()

    while True:

        try:

            user_input = input("\nYou: ").strip()

            if not user_input:

                continue

            command = user_input.lower()

            if command == "exit":

                print("\nSentinel AI shutting down.")
                break

            elif command == "clear":

                conversation_history.clear()

                print("\nConversation memory cleared.")

            elif command == "/phishing":

                phishing_analysis()

            elif command == "/logs":

                log_analysis()

            elif command == "/anomaly":

                anomaly_analysis()

            else:

                generate_response(user_input)

        except KeyboardInterrupt:

            print("\nSentinel AI shutting down.")
            break

        except EOFError:

            print("\nInput closed.")
            break

        except Exception as error:

            print("\nError:", error)


if __name__ == "__main__":
    main()