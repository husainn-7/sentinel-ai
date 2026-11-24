from security.phishing import detect_keywords
from security.url_analyzer import analyze_urls


KEYWORD_WEIGHTS = {
    "urgency": 10,
    "credentials": 25,
    "threats": 15,
    "financial": 15
}


URL_WEIGHTS = {
    "Unencrypted HTTP connection": 10,
    "IP address used instead of domain": 20,
    "Excessive domain levels": 10,
    "Unusually long URL": 5,
    "Punycode domain detected": 15,
    "Embedded URL user information": 20,
    "Malformed URL": 10,
    "Invalid or missing hostname": 10
}


def classify_risk(score):

    if score >= 80:
        return "Critical"

    elif score >= 50:
        return "High"

    elif score >= 20:
        return "Medium"

    return "Low"


def analyze_email(text):

    score = 0

    keyword_results = detect_keywords(text)

    url_results = analyze_urls(text)

    # Calculate keyword risk
    for category, matches in keyword_results.items():

        weight = KEYWORD_WEIGHTS.get(category, 0)

        score += weight * len(matches)

    # Calculate URL risk
    seen_urls = set()

    for result in url_results:

        if result["url"] in seen_urls:
            continue

        seen_urls.add(result["url"])

        for indicator in result["indicators"]:

            if indicator.startswith("Suspicious keyword:"):
                score += 5

            else:
                score += URL_WEIGHTS.get(indicator, 0)

    # Limit the score to 100
    score = min(score, 100)

    return {
        "risk_score": score,
        "risk_level": classify_risk(score),
        "keyword_indicators": keyword_results,
        "url_analysis": url_results
    }


if __name__ == "__main__":

    sample_email = """
    URGENT: Your account locked.

    Verify your password immediately.

    Visit http://192.0.2.1/login
    """

    result = analyze_email(sample_email)

    print("=" * 50)
    print("SENTINEL AI - PHISHING ANALYSIS")
    print("=" * 50)

    print("Risk Score:", result["risk_score"], "/ 100")

    print("Risk Level:", result["risk_level"])

    print("\nKeyword Indicators:")

    for category, matches in result["keyword_indicators"].items():
        print(f"{category}: {matches}")

    print("\nURL Analysis:")

    for url in result["url_analysis"]:
        print(url)