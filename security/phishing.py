import re


PHISHING_KEYWORDS = {
    "urgency": [
        "urgent",
        "immediately",
        "act now",
        "final warning",
        "within 24 hours",
        "limited time"
    ],

    "credentials": [
        "verify your password",
        "confirm your password",
        "login credentials",
        "verify your account",
        "credit card number",
        "security code"
    ],

    "threats": [
        "account suspended",
        "account terminated",
        "account locked",
        "unauthorized activity",
        "unauthorised activity",
        "legal action"
    ],

    "financial": [
        "claim your reward",
        "wire transfer",
        "payment required",
        "you have won",
        "claim your prize"
    ]
}


def detect_keywords(text):

    detected = {}

    for category, keywords in PHISHING_KEYWORDS.items():

        matches = []

        for keyword in keywords:

            pattern = r"\b" + re.escape(keyword) + r"\b"

            if re.search(pattern, text, re.IGNORECASE):
                matches.append(keyword)

        if matches:
            detected[category] = matches

    return detected


if __name__ == "__main__":

    sample_email = """
    URGENT: Your account has been locked.

    Verify your password immediately to avoid legal action.
    """

    results = detect_keywords(sample_email)

    print("Detected phishing indicators:")

    for category, matches in results.items():
        print(f"{category}: {matches}")