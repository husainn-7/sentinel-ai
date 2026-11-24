from security.threat_detector import analyze_authentication
from security.time_analyzer import detect_rapid_failures


def analyze_security_logs(log_text):

    auth_results = analyze_authentication(log_text)

    rapid_failure_alerts = detect_rapid_failures(log_text)

    total_failed = sum(
        ip["failed_attempts"]
        for ip in auth_results["ip_analysis"]
    )

    total_successful = sum(
        ip["successful_attempts"]
        for ip in auth_results["ip_analysis"]
    )

    suspicious_ips = [
        ip["ip_address"]
        for ip in auth_results["ip_analysis"]
        if ip["possible_brute_force"]
    ]

    risk_priority = {
        "Low": 0,
        "Medium": 1,
        "High": 2,
        "Critical": 3
    }

    if auth_results["total_events"] == 0:

        overall_risk = "Unknown"

    else:

        overall_risk = max(
            (
                ip["risk_level"]
                for ip in auth_results["ip_analysis"]
            ),
            key=lambda level: risk_priority[level],
            default="Low"
        )

        if rapid_failure_alerts:

            if risk_priority[overall_risk] < 2:
                overall_risk = "High"

    return {
        "overall_risk": overall_risk,

        "summary": {
            "total_events": auth_results["total_events"],
            "unique_ips": auth_results["unique_ips"],
            "failed_logins": total_failed,
            "successful_logins": total_successful,
            "suspicious_ips": suspicious_ips,
            "rapid_failure_alerts": len(
                rapid_failure_alerts
            )
        },

        "ip_analysis": auth_results["ip_analysis"],

        "time_window_alerts": rapid_failure_alerts
    }


if __name__ == "__main__":

    import json

    sample_logs = """
Nov 24 10:00:01 server sshd[1001]: Failed password for root from 192.0.2.10 port 54321 ssh2
Nov 24 10:00:05 server sshd[1002]: Failed password for root from 192.0.2.10 port 54322 ssh2
Nov 24 10:00:09 server sshd[1003]: Failed password for admin from 192.0.2.10 port 54323 ssh2
Nov 24 10:00:12 server sshd[1004]: Failed password for admin from 192.0.2.10 port 54324 ssh2
Nov 24 10:00:15 server sshd[1005]: Failed password for root from 192.0.2.10 port 54325 ssh2
Nov 24 10:00:20 server sshd[1006]: Failed password for root from 192.0.2.10 port 54326 ssh2
Nov 24 10:02:00 server sshd[1007]: Accepted password for admin from 192.0.2.20 port 54327 ssh2
"""

    result = analyze_security_logs(sample_logs)

    print("=" * 50)
    print("SENTINEL AI - SECURITY LOG ENGINE")
    print("=" * 50)

    print(json.dumps(result, indent=4))