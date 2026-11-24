import unittest

from ml.predict_anomaly import (
    extract_features,
    predict_anomalies,
    load_model
)


def create_logs(count):

    return "\n".join(
        f"Nov 24 10:01:{i:02d} server sshd[{2000+i}]: "
        f"Failed password for invalid user admin "
        f"from 198.51.100.20 port {51000+i} ssh2"
        for i in range(count)
    )


class TestAnomalyDetection(unittest.TestCase):

    def test_model_loading(self):

        model = load_model()

        self.assertIsNotNone(model)


    def test_empty_logs(self):

        result = predict_anomalies("")

        self.assertEqual(result["total_windows"], 0)


    def test_invalid_logs(self):

        result = predict_anomalies("Invalid log content")

        self.assertEqual(result["total_windows"], 0)


    def test_feature_extraction(self):

        records = extract_features(create_logs(10))

        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["failed_attempts"], 10)
        self.assertEqual(records[0]["successful_attempts"], 0)
        self.assertEqual(records[0]["total_attempts"], 10)
        self.assertEqual(records[0]["unique_usernames"], 1)
        self.assertEqual(records[0]["failure_rate"], 1.0)


    def test_normal_activity(self):

        logs = (
            "Nov 24 10:00:01 server sshd[1001]: "
            "Accepted password for alice "
            "from 192.0.2.10 port 50100 ssh2\n"

            "Nov 24 10:00:05 server sshd[1002]: "
            "Failed password for alice "
            "from 192.0.2.10 port 50101 ssh2\n"

            "Nov 24 10:00:12 server sshd[1003]: "
            "Accepted password for alice "
            "from 192.0.2.10 port 50102 ssh2"
        )

        result = predict_anomalies(logs)

        self.assertEqual(result["ml_anomalies"], 0)
        self.assertEqual(result["rule_alerts"], 0)


    def test_suspicious_activity(self):

        result = predict_anomalies(create_logs(30))

        self.assertEqual(result["ml_anomalies"], 1)
        self.assertEqual(result["rule_alerts"], 1)


    def test_rule_threshold(self):

        result = predict_anomalies(create_logs(5))

        self.assertEqual(result["rule_alerts"], 1)


    def test_below_rule_threshold(self):

        result = predict_anomalies(create_logs(4))

        self.assertEqual(result["rule_alerts"], 0)


    def test_window_separation(self):

        logs = create_logs(5)

        logs += "\n" + create_logs(5).replace(
            "10:01:", "10:02:"
        )

        records = extract_features(logs)

        self.assertEqual(len(records), 2)


    def test_decision_score_consistency(self):

        result = predict_anomalies(create_logs(30))

        record = result["results"][0]

        self.assertEqual(
            record["ml_anomaly"],
            record["decision_score"] < 0
        )


if __name__ == "__main__":
    unittest.main()