from security.log_analyzer import parse_logs


def classify_login_risk(failed_attempts):

    if failed_attempts >= 10:
        return "Critical"

    elif failed_attempts >= 5:
        return "High"

    elif failed_attempts >= 3:
        return "Medium"

    return "Low"


def analyze_authentication(log_text):

    events = parse_logs(log_text)

    ip_statistics = {}

    for event in events:

        ip = event["ip_address"]

        if ip not in ip_statistics:

            ip_statistics[ip] = {
                "failed_attempts": 0,
                "successful_attempts": 0,
                "total_attempts": 0,
                "usernames": set()
            }

        stats = ip_statistics[ip]

        stats["total_attempts"] += 1

        stats["usernames"].add(event["username"])

        if event["status"] == "Failed":

            stats["failed_attempts"] += 1

        elif event["status"] == "Accepted":

            stats["successful_attempts"] += 1

    results = []

    for ip, stats in ip_statistics.items():

        risk_level = classify_login_risk(
            stats["failed_attempts"]
        )

        results.append({
            "ip_address": ip,
            "failed_attempts": stats["failed_attempts"],
            "successful_attempts": stats["successful_attempts"],
            "total_attempts": stats["total_attempts"],
            "usernames": sorted(stats["usernames"]),
            "risk_level": risk_level,
            "possible_brute_force": (
                stats["failed_attempts"] >= 5
            )
        })

    return {
        "total_events": len(events),
        "unique_ips": len(ip_statistics),
        "ip_analysis": results
    }


if __name__ == "__main__":

    sample_logs = """
Nov 24 10:00:01 server sshd[1001]: Failed password for root from 192.0.2.10 port 54321 ssh2
Nov 24 10:00:05 server sshd[1002]: Failed password for root from 192.0.2.10 port 54322 ssh2
Nov 24 10:00:09 server sshd[1003]: Failed password for admin from 192.0.2.10 port 54323 ssh2
Nov 24 10:00:12 server sshd[1004]: Failed password for admin from 192.0.2.10 port 54324 ssh2
Nov 24 10:00:15 server sshd[1005]: Failed password for root from 192.0.2.10 port 54325 ssh2
Nov 24 10:00:20 server sshd[1006]: Failed password for root from 192.0.2.10 port 54326 ssh2
Nov 24 10:02:00 server sshd[1007]: Accepted password for admin from 192.0.2.20 port 54327 ssh2
"""

    result = analyze_authentication(sample_logs)

    print("=" * 50)
    print("SENTINEL AI - AUTHENTICATION ANALYSIS")
    print("=" * 50)

    print("Total events:", result["total_events"])
    print("Unique IP addresses:", result["unique_ips"])

    for ip in result["ip_analysis"]:

        print("\nIP Address:", ip["ip_address"])
        print("Failed Attempts:", ip["failed_attempts"])
        print("Successful Attempts:", ip["successful_attempts"])
        print("Total Attempts:", ip["total_attempts"])
        print("Usernames:", ip["usernames"])
        print("Risk Level:", ip["risk_level"])
        print("Possible Brute Force:", ip["possible_brute_force"])