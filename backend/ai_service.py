import json
import ollama

from pathlib import Path


# ==============================
# CONFIGURATION
# ==============================

MODEL = "llama3.2:latest"

BASE_DIR = Path(__file__).resolve().parent.parent

PROMPT_DIR = BASE_DIR / "prompts"


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
# CHAT SERVICE
# ==============================

def chat(message):

    return generate_ai_response(
        SYSTEM_PROMPT,
        message,
        temperature=0.3,
        max_tokens=500
    )


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