import unittest

from security.risk_engine import analyze_email


class TestRiskEngine(unittest.TestCase):

    def test_legitimate_email(self):

        email = """
        Hello,

        Our team meeting is scheduled for Monday.
        Please bring your project documents.

        Thank you.
        """

        result = analyze_email(email)

        self.assertEqual(result["risk_score"], 0)
        self.assertEqual(result["risk_level"], "Low")


    def test_urgency_email(self):

        email = """
        URGENT: Please respond immediately.
        """

        result = analyze_email(email)

        self.assertEqual(result["risk_score"], 20)
        self.assertEqual(result["risk_level"], "Medium")


    def test_high_risk_email(self):

        email = """
        Urgent: Verify your password immediately.

        Visit https://verify.example.com
        """

        result = analyze_email(email)

        self.assertEqual(result["risk_score"], 50)
        self.assertEqual(result["risk_level"], "High")


    def test_critical_phishing_email(self):

        email = """
        URGENT: Your account locked.

        Verify your password immediately.

        Visit http://192.0.2.1/login
        """

        result = analyze_email(email)

        self.assertEqual(result["risk_score"], 90)
        self.assertEqual(result["risk_level"], "Critical")


    def test_empty_email(self):

        result = analyze_email("")

        self.assertEqual(result["risk_score"], 0)


    def test_duplicate_urls(self):

        email = """
        http://192.0.2.1/login
        http://192.0.2.1/login
        """

        result = analyze_email(email)

        self.assertEqual(result["risk_score"], 30)


    def test_maximum_score(self):

        email = """
        Urgent. Immediately. Final warning.
        Act now. Within 24 hours.

        Verify your password.
        Confirm your password.
        Verify your account.
        Login credentials.
        """

        result = analyze_email(email)

        self.assertEqual(result["risk_score"], 100)


if __name__ == "__main__":
    unittest.main()