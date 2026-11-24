from datetime import datetime
from collections import defaultdict

from security.log_analyzer import parse_logs


WINDOW_SECONDS = 60
FAILURE_THRESHOLD = 5


def detect_rapid_failures(
    log_text,
    window_seconds=WINDOW_SECONDS,
    threshold=FAILURE_THRESHOLD
):

    events = parse_logs(log_text)

    failed_events = defaultdict(list)

    for event in events:

        if event["status"] != "Failed":
            continue

        try:
            timestamp = datetime.strptime(
                "2026 " + event["timestamp"],
                "%Y %b %d %H:%M:%S"
            )

        except ValueError:
            continue

        failed_events[event["ip_address"]].append(
            timestamp
        )

    alerts = []

    for ip, timestamps in failed_events.items():

        timestamps.sort()

        left = 0
        max_failures = 0
        peak_start = None
        peak_end = None

        for right in range(len(timestamps)):

            while (
                timestamps[right] - timestamps[left]
            ).total_seconds() > window_seconds:

                left += 1

            current_failures = right - left + 1

            if current_failures > max_failures:

                max_failures = current_failures

                peak_start = timestamps[left]
                peak_end = timestamps[right]

        if max_failures >= threshold:

            duration = (
                peak_end - peak_start
            ).total_seconds()

            alerts.append({
                "ip_address": ip,
                "failed_attempts": max_failures,
                "duration_seconds": duration,
                "window_seconds": window_seconds,
                "alert": "Possible brute-force attack"
            })

    return alerts


if __name__ == "__main__":

    sample_logs = """
Nov 24 10:00:01 server sshd[1001]: Failed password for root from 192.0.2.10 port 54321 ssh2
Nov 24 10:00:05 server sshd[1002]: Failed password for root from 192.0.2.10 port 54322 ssh2
Nov 24 10:00:09 server sshd[1003]: Failed password for admin from 192.0.2.10 port 54323 ssh2
Nov 24 10:00:12 server sshd[1004]: Failed password for admin from 192.0.2.10 port 54324 ssh2
Nov 24 10:00:15 server sshd[1005]: Failed password for root from 192.0.2.10 port 54325 ssh2
Nov 24 10:00:20 server sshd[1006]: Failed password for root from 192.0.2.10 port 54326 ssh2
"""

    alerts = detect_rapid_failures(sample_logs)

    print("=" * 50)
    print("SENTINEL AI - TIME WINDOW ANALYSIS")
    print("=" * 50)

    print("Total alerts:", len(alerts))

    for alert in alerts:

        print("\nIP Address:", alert["ip_address"])
        print("Failed Attempts:", alert["failed_attempts"])
        print("Duration:", alert["duration_seconds"], "seconds")
        print("Time Window:", alert["window_seconds"], "seconds")
        print("Alert:", alert["alert"])