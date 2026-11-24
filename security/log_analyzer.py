import re
import ipaddress


AUTH_PATTERN = re.compile(
    r"(?P<timestamp>\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})"
    r"\s+\S+\s+sshd\[\d+\]:\s+"
    r"(?P<status>Failed|Accepted)\s+password\s+for\s+"
    r"(?:invalid user\s+)?"
    r"(?P<username>\S+)\s+from\s+"
    r"(?P<ip>\S+)\s+port\s+"
    r"(?P<port>\d+)"
)


def parse_log_line(line):

    match = AUTH_PATTERN.search(line)

    if not match:
        return None

    event = match.groupdict()

    try:
        ipaddress.ip_address(event["ip"])
    except ValueError:
        return None

    return {
        "timestamp": event["timestamp"],
        "status": event["status"],
        "username": event["username"],
        "ip_address": event["ip"],
        "port": int(event["port"])
    }


def parse_logs(log_text):

    events = []

    for line in log_text.splitlines():

        event = parse_log_line(line)

        if event:
            events.append(event)

    return events


if __name__ == "__main__":

    sample_logs = """
Nov 24 10:00:01 server sshd[1234]: Failed password for root from 192.0.2.10 port 54321 ssh2
Nov 24 10:00:05 server sshd[1235]: Failed password for root from 192.0.2.10 port 54322 ssh2
Nov 24 10:00:09 server sshd[1236]: Failed password for root from 192.0.2.10 port 54323 ssh2
Nov 24 10:02:00 server sshd[1237]: Accepted password for admin from 192.0.2.20 port 54324 ssh2
"""

    events = parse_logs(sample_logs)

    print("SENTINEL AI - LOG ANALYSER")
    print("=" * 50)

    print("Total authentication events:", len(events))

    for event in events:
        print(event)