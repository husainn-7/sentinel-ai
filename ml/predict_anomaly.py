import json
import joblib
import pandas as pd

from pathlib import Path
from datetime import datetime
from collections import defaultdict

from security.log_analyzer import parse_logs
from ml.prepare_data import FEATURE_COLUMNS


# ==============================
# CONFIGURATION
# ==============================

BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_PATH = (
    BASE_DIR
    / "models"
    / "isolation_forest_final.joblib"
)

WINDOW_SECONDS = 60


# ==============================
# LOAD TRAINED MODEL
# ==============================

def load_model():

    if not MODEL_PATH.exists():

        raise FileNotFoundError(
            "Trained model not found. "
            "Run python -m ml.train_final_model first."
        )

    # Only load our locally generated model artifact
    artifact = joblib.load(MODEL_PATH)

    if artifact["features"] != FEATURE_COLUMNS:

        raise ValueError(
            "Model feature configuration mismatch."
        )

    if artifact["window_seconds"] != WINDOW_SECONDS:

        raise ValueError(
            "Model window configuration mismatch."
        )

    return artifact["model"]


# ==============================
# FEATURE EXTRACTION
# ==============================

def extract_features(log_text):

    events = parse_logs(log_text)

    windows = defaultdict(list)

    for event in events:

        try:

            timestamp = datetime.strptime(
                "2000 " + event["timestamp"],
                "%Y %b %d %H:%M:%S"
            )

        except ValueError:

            continue

        window_start = timestamp.replace(
            second=0,
            microsecond=0
        )

        key = (
            event["ip_address"],
            window_start
        )

        windows[key].append(event)

    records = []

    for (ip_address, window), events in sorted(
        windows.items()
    ):

        failed = sum(
            event["status"].lower() == "failed"
            for event in events
        )

        successful = sum(
            event["status"].lower() == "accepted"
            for event in events
        )

        total = failed + successful

        if total == 0:

            continue

        unique_users = len({
            event["username"]
            for event in events
        })

        records.append({
            "ip_address": ip_address,

            "window_start": window.strftime(
                "%b %d %H:%M:%S"
            ),

            "failed_attempts": failed,

            "successful_attempts": successful,

            "total_attempts": total,

            "unique_usernames": unique_users,

            "failure_rate": failed / total
        })

    return records


# ==============================
# ANOMALY PREDICTION
# ==============================

def predict_anomalies(log_text):

    records = extract_features(log_text)

    if not records:

        return {
            "status": "No valid authentication windows",
            "total_windows": 0,
            "ml_anomalies": 0,
            "rule_alerts": 0,
            "results": []
        }

    model = load_model()

    df = pd.DataFrame(records)

    X = df[FEATURE_COLUMNS]

    predictions = model.predict(X)

    decision_scores = model.decision_function(X)

    results = []

    for index, record in enumerate(records):

        ml_anomaly = bool(
            predictions[index] == -1
        )

        rule_alert = bool(
            record["failed_attempts"] >= 5
        )

        if ml_anomaly and rule_alert:

            assessment = "ML and rule alert"

        elif ml_anomaly:

            assessment = "ML anomaly only"

        elif rule_alert:

            assessment = "Rule alert only"

        else:

            assessment = "No anomaly flagged"

        results.append({
            **record,

            "ml_anomaly": ml_anomaly,

            "decision_score": round(
                float(decision_scores[index]),
                6
            ),

            "rule_alert": rule_alert,

            "assessment": assessment
        })

    return {
        "status": "Analysis completed",

        "model": "Isolation Forest",

        "window_seconds": WINDOW_SECONDS,

        "total_windows": len(results),

        "ml_anomalies": sum(
            item["ml_anomaly"]
            for item in results
        ),

        "rule_alerts": sum(
            item["rule_alert"]
            for item in results
        ),

        "results": results
    }


# ==============================
# STANDALONE DEMONSTRATION
# ==============================

def main():

    print("=" * 60)
    print("SENTINEL AI - ANOMALY PREDICTION ENGINE")
    print("=" * 60)

    sample_logs = [
        "Nov 24 10:00:01 server sshd[1001]: "
        "Accepted password for alice "
        "from 192.0.2.10 port 50100 ssh2",

        "Nov 24 10:00:05 server sshd[1002]: "
        "Failed password for alice "
        "from 192.0.2.10 port 50101 ssh2",

        "Nov 24 10:00:12 server sshd[1003]: "
        "Accepted password for alice "
        "from 192.0.2.10 port 50102 ssh2"
    ]

    # Synthetic suspicious authentication records

    for i in range(30):

        sample_logs.append(
            f"Nov 24 10:01:{i:02d} "
            f"server sshd[{2000 + i}]: "
            f"Failed password for invalid user admin "
            f"from 198.51.100.20 "
            f"port {51000 + i} ssh2"
        )

    log_text = "\n".join(sample_logs)

    report = predict_anomalies(log_text)

    print(json.dumps(report, indent=4))

    print("\nAnomaly prediction completed.")


if __name__ == "__main__":
    main()