
import json
import ollama

from pathlib import Path


# ==============================
# CONFIGURATION
# ==============================

MODEL = "llama3.2:latest"

BASE_DIR = Path(__file__).resolve().parent.parent

PROMPT_DIR = BASE_DIR / "prompts"

MAX_HISTORY_MESSAGES = 6

MAX_HISTORY_CHARACTERS = 6000


# ==============================
# LOAD SYSTEM PROMPTS
# ==============================

SYSTEM_PROMPT = (
    PROMPT_DIR / "system_prompt.txt"
).read_text(encoding="utf-8")

PHISHING_PROMPT = (
    PROMPT_DIR / "phishing_prompt.txt"
).read_text(encoding="utf-8")

LOG_PROMPT = (
    PROMPT_DIR / "log_prompt.txt"
).read_text(encoding="utf-8")

ANOMALY_PROMPT = (
    PROMPT_DIR / "anomaly_prompt.txt"
).read_text(encoding="utf-8")


# ==============================
# CONVERSATION MEMORY BUILDER
# ==============================

def build_chat_messages(message, history=None):

    messages = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT
        }
    ]

    selected_history = []

    total_characters = 0

    if history:

        recent_history = history[-MAX_HISTORY_MESSAGES:]

        for item in reversed(recent_history):

            if hasattr(item, "model_dump"):

                item = item.model_dump()

            role = item.get("role")

            content = item.get("content", "").strip()

            if role not in ("user", "assistant"):

                continue

            if not content:

                continue

            if (
                total_characters + len(content)
                > MAX_HISTORY_CHARACTERS
            ):

                break

            selected_history.append({
                "role": role,
                "content": content
            })

            total_characters += len(content)

    selected_history.reverse()

    messages.extend(selected_history)

    messages.append({
        "role": "user",
        "content": message
    })

    return messages


# ==============================
# CORE AI SERVICE
# ==============================

def generate_ai_response(
    prompt,
    content,
    temperature=0.2,
    max_tokens=300
):

    response = ollama.chat(
        model=MODEL,
        messages=[
            {
                "role": "system",
                "content": prompt
            },
            {
                "role": "user",
                "content": content
            }
        ],
        options={
            "temperature": temperature,
            "num_predict": max_tokens
        }
    )

    return response["message"]["content"]


# ==============================
# CONTEXT-AWARE CHAT SERVICE
# ==============================

def chat(message, history=None):

    messages = build_chat_messages(
        message,
        history
    )

    response = ollama.chat(
        model=MODEL,
        messages=messages,
        options={
            "temperature": 0.3,
            "num_predict": 500
        }
    )

    return response["message"]["content"]


# ==============================
# PHISHING REPORT SERVICE
# ==============================

def generate_phishing_report(analysis):

    return generate_ai_response(
        PHISHING_PROMPT,
        json.dumps(analysis, indent=2)
    )


# ==============================
# SECURITY LOG REPORT SERVICE
# ==============================

def generate_log_report(analysis):

    return generate_ai_response(
        LOG_PROMPT,
        json.dumps(analysis, indent=2)
    )


# ==============================
# ANOMALY REPORT SERVICE
# ==============================

def generate_anomaly_report(analysis):

    findings = []

    for record in analysis["results"]:

        findings.append({
            "ip_address": record["ip_address"],
            "failed_attempts": record["failed_attempts"],
            "successful_attempts": record["successful_attempts"],
            "ml_anomaly": record["ml_anomaly"],
            "rule_alert": record["rule_alert"],
            "assessment": record["assessment"]
        })

    advisory_data = {
        "total_windows": analysis["total_windows"],
        "ml_anomalies": analysis["ml_anomalies"],
        "rule_alerts": analysis["rule_alerts"],
        "findings": findings
    }

    return generate_ai_response(
        ANOMALY_PROMPT,
        json.dumps(advisory_data, indent=2),
        temperature=0.1,
        max_tokens=220
    )
