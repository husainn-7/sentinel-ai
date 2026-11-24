import numpy as np
import pandas as pd

from pathlib import Path


RANDOM_STATE = 42

NORMAL_SAMPLES = 9000
ANOMALY_SAMPLES = 1000

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

rng = np.random.default_rng(RANDOM_STATE)


def create_record(failed, successful, users, label, scenario):

    total = failed + successful

    return {
        "failed_attempts": failed,
        "successful_attempts": successful,
        "total_attempts": total,
        "unique_usernames": min(users, total),
        "failure_rate": failed / total if total else 0,
        "label": label,
        "scenario": scenario
    }


def generate_normal_activity():

    scenario = rng.choice(
        ["regular", "busy_server", "password_errors"],
        p=[0.70, 0.20, 0.10]
    )

    if scenario == "regular":

        failed = int(rng.poisson(1))
        successful = int(rng.integers(1, 16))
        users = int(rng.integers(1, 5))

    elif scenario == "busy_server":

        failed = int(rng.poisson(4))
        successful = int(rng.integers(15, 81))
        users = int(rng.integers(3, 21))

    else:

        failed = int(rng.integers(3, 15))
        successful = int(rng.integers(1, 6))
        users = int(rng.integers(1, 4))

    return create_record(
        failed,
        successful,
        users,
        0,
        scenario
    )


def generate_anomalous_activity():

    scenario = rng.choice([
        "brute_force",
        "password_spraying",
        "credential_stuffing",
        "possible_account_compromise"
    ])

    if scenario == "brute_force":

        failed = int(rng.integers(15, 151))
        successful = int(rng.integers(0, 4))
        users = int(rng.integers(1, 5))

    elif scenario == "password_spraying":

        failed = int(rng.integers(5, 51))
        successful = int(rng.integers(0, 4))
        users = int(rng.integers(5, 41))

    elif scenario == "credential_stuffing":

        failed = int(rng.integers(10, 101))
        successful = int(rng.integers(1, 11))
        users = int(rng.integers(5, 31))

    else:

        failed = int(rng.integers(3, 21))
        successful = int(rng.integers(1, 5))
        users = int(rng.integers(1, 4))

    return create_record(
        failed,
        successful,
        users,
        1,
        scenario
    )


def generate_dataset():

    records = []

    for _ in range(NORMAL_SAMPLES):
        records.append(generate_normal_activity())

    for _ in range(ANOMALY_SAMPLES):
        records.append(generate_anomalous_activity())

    df = pd.DataFrame(records)

    df = df.sample(
        frac=1,
        random_state=RANDOM_STATE
    ).reset_index(drop=True)

    return df


def main():

    DATA_DIR.mkdir(exist_ok=True)

    df = generate_dataset()

    output_path = DATA_DIR / "authentication_data_v2.csv"

    df.to_csv(output_path, index=False)

    print("=" * 50)
    print("SENTINEL AI - ADVANCED DATASET GENERATOR")
    print("=" * 50)

    print("Total observations:", len(df))

    print("\nClass distribution:")
    print(df["label"].value_counts())

    print("\nScenario distribution:")
    print(df["scenario"].value_counts())

    print("\nDuplicate rows:")
    print(df.duplicated().sum())

    print("\nUnique feature combinations:")

    features = df.drop(
        columns=["label", "scenario"]
    )

    print(len(features.drop_duplicates()))

    print("\nMissing values:")
    print(df.isnull().sum())

    print("\nDataset saved to:")
    print(output_path)


if __name__ == "__main__":
    main()