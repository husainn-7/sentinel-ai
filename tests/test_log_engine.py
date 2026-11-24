import unittest

from security.log_analyzer import parse_logs
from security.threat_detector import analyze_authentication
from security.time_analyzer import detect_rapid_failures
from security.log_engine import analyze_security_logs


def create_failed_logs(count, interval=5):

    lines = []

    for i in range(count):

        seconds = i * interval
        minutes = seconds // 60
        seconds = seconds % 60

        line = (
            f"Nov 24 10:{minutes:02d}:{seconds:02d} "
            f"server sshd[{1000 + i}]: "
            f"Failed password for root "
            f"from 192.0.2.10 port {54321 + i} ssh2"
        )

        lines.append(line)

    return "\n".join(lines)


class TestLogEngine(unittest.TestCase):

    def test_successful_login(self):

        logs = (
            "Nov 24 10:00:01 server sshd[1001]: "
            "Accepted password for admin "
            "from 192.0.2.20 port 54321 ssh2"
        )

        result = analyze_security_logs(logs)

        self.assertEqual(
            result["overall_risk"], "Low"
        )

        self.assertEqual(
            result["summary"]["successful_logins"], 1
        )


    def test_failed_login(self):

        logs = create_failed_logs(1)

        events = parse_logs(logs)

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["status"], "Failed")


    def test_medium_risk(self):

        logs = create_failed_logs(3)

        result = analyze_security_logs(logs)

        self.assertEqual(
            result["overall_risk"], "Medium"
        )


    def test_high_risk(self):

        logs = create_failed_logs(6)

        result = analyze_security_logs(logs)

        self.assertEqual(
            result["overall_risk"], "High"
        )


    def test_critical_risk(self):

        logs = create_failed_logs(10)

        result = analyze_security_logs(logs)

        self.assertEqual(
            result["overall_risk"], "Critical"
        )


    def test_rapid_failure_detection(self):

        logs = create_failed_logs(6, interval=5)

        alerts = detect_rapid_failures(logs)

        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["failed_attempts"], 6)
        self.assertEqual(alerts[0]["duration_seconds"], 25)


    def test_slow_failures(self):

        logs = create_failed_logs(6, interval=120)

        alerts = detect_rapid_failures(logs)

        self.assertEqual(len(alerts), 0)


    def test_ip_aggregation(self):

        logs = create_failed_logs(6)

        result = analyze_authentication(logs)

        self.assertEqual(result["unique_ips"], 1)

        self.assertEqual(
            result["ip_analysis"][0]["failed_attempts"],
            6
        )


    def test_empty_logs(self):

        result = analyze_security_logs("")

        self.assertEqual(
            result["overall_risk"], "Unknown"
        )

        self.assertEqual(
            result["summary"]["total_events"], 0
        )


    def test_invalid_logs(self):

        logs = "This is not an authentication log."

        result = analyze_security_logs(logs)

        self.assertEqual(
            result["overall_risk"], "Unknown"
        )


    def test_invalid_ip_address(self):

        logs = (
            "Nov 24 10:00:01 server sshd[1001]: "
            "Failed password for root "
            "from 999.999.999.999 port 54321 ssh2"
        )

        events = parse_logs(logs)

        self.assertEqual(len(events), 0)


if __name__ == "__main__":
    unittest.main()