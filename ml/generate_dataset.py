import numpy as np
import pandas as pd

from pathlib import Path


RANDOM_STATE = 42
NORMAL_SAMPLES = 900
ANOMALY_SAMPLES = 100

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

rng = np.random.default_rng(RANDOM_STATE)


def generate_normal_activity():

    failed = int(rng.integers(0, 4))
    successful = int(rng.integers(1, 6))

    total = failed + successful

    unique_users = int(
        rng.integers(1, min(3, total) + 1)
    )

    return {
        "failed_attempts": failed,
        "successful_attempts": successful,
        "total_attempts": total,
        "unique_usernames": unique_users,
        "failure_rate": failed / total,
        "label": 0
    }


def generate_anomalous_activity():

    failed = int(rng.integers(5, 61))
    successful = int(rng.integers(0, 4))

    total = failed + successful

    unique_users = int(
        rng.integers(1, min(15, total) + 1)
    )

    return {
        "failed_attempts": failed,
        "successful_attempts": successful,
        "total_attempts": total,
        "unique_usernames": unique_users,
        "failure_rate": failed / total,
        "label": 1
    }


def generate_dataset():

    records = []

    for _ in range(NORMAL_SAMPLES):
        records.append(generate_normal_activity())

    for _ in range(ANOMALY_SAMPLES):
        records.append(generate_anomalous_activity())

    dataset = pd.DataFrame(records)

    dataset = dataset.sample(
        frac=1,
        random_state=RANDOM_STATE
    ).reset_index(drop=True)

    return dataset


def main():

    DATA_DIR.mkdir(exist_ok=True)

    dataset = generate_dataset()

    output_path = DATA_DIR / "authentication_data.csv"

    dataset.to_csv(output_path, index=False)

    print("=" * 50)
    print("SENTINEL AI - ML DATASET GENERATOR")
    print("=" * 50)

    print("Total observations:", len(dataset))

    print(
        "Normal observations:",
        len(dataset[dataset["label"] == 0])
    )

    print(
        "Anomalous observations:",
        len(dataset[dataset["label"] == 1])
    )

    print("\nDataset preview:")
    print(dataset.head(10))

    print("\nDataset saved to:")
    print(output_path)


if __name__ == "__main__":
    main()