import re
import ipaddress
from urllib.parse import urlparse


SUSPICIOUS_KEYWORDS = [
    "login",
    "verify",
    "secure",
    "password",
    "update",
    "account",
    "confirm",
    "banking"
]


def extract_urls(text):

    pattern = r'https?://[^\s<>"\']+'

    return [
        url.rstrip(".,;!?)]")
        for url in re.findall(pattern, text, re.IGNORECASE)
    ]


def analyze_url(url):

    indicators = []

    try:
        parsed = urlparse(url)
        hostname = parsed.hostname or ""

        if not hostname:
            return {
                "url": url,
                "indicators": ["Invalid or missing hostname"],
                "indicator_count": 1
            }

        # Check for unencrypted HTTP
        if parsed.scheme.lower() == "http":
            indicators.append("Unencrypted HTTP connection")

        # Check for IP-based URLs
        try:
            ipaddress.ip_address(hostname)
            indicators.append("IP address used instead of domain")
        except ValueError:
            pass

        # Check for excessive domain levels
        if hostname.count(".") > 3:
            indicators.append("Excessive domain levels")

        # Check for suspicious keywords
        for keyword in SUSPICIOUS_KEYWORDS:
            if keyword in hostname.lower():
                indicators.append(
                    f"Suspicious keyword: {keyword}"
                )

        # Check URL length
        if len(url) > 100:
            indicators.append("Unusually long URL")

        # Check for Punycode
        if any(
            part.startswith("xn--")
            for part in hostname.lower().split(".")
        ):
            indicators.append("Punycode domain detected")

        # Check for embedded user information
        if parsed.username is not None:
            indicators.append("Embedded URL user information")

    except ValueError:
        indicators.append("Malformed URL")

    return {
        "url": url,
        "indicators": indicators,
        "indicator_count": len(indicators)
    }


def analyze_urls(text):

    urls = extract_urls(text)

    return [analyze_url(url) for url in urls]


if __name__ == "__main__":

    sample_email = """
    Please verify your account immediately.

    http://192.0.2.1/login

    http://secure-bank-verify.example.com/update

    https://example.com
    """

    results = analyze_urls(sample_email)

    for result in results:

        print("\nURL:", result["url"])

        print("Indicators:", result["indicators"])

        print("Indicator count:", result["indicator_count"])