import pandas as pd
import matplotlib.pyplot as plt

from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent

DATA_PATH = BASE_DIR / "data" / "authentication_data.csv"

REPORT_DIR = BASE_DIR / "reports"


def load_dataset():

    return pd.read_csv(DATA_PATH)


def explore_dataset(df):

    print("=" * 50)
    print("SENTINEL AI - EXPLORATORY DATA ANALYSIS")
    print("=" * 50)

    print("\nDataset Shape:")
    print(df.shape)

    print("\nDataset Columns:")
    print(df.columns.tolist())

    print("\nData Types:")
    print(df.dtypes)

    print("\nMissing Values:")
    print(df.isnull().sum())

    print("\nDuplicate Rows:")
    print(df.duplicated().sum())

    print("\nStatistical Summary:")
    print(df.describe().round(2))

    print("\nClass Distribution:")
    print(df["label"].value_counts())

    print("\nAverage Features by Class:")
    print(df.groupby("label").mean().round(2))


def generate_visualizations(df):

    REPORT_DIR.mkdir(exist_ok=True)

    normal = df[df["label"] == 0]
    anomalous = df[df["label"] == 1]

    # Chart 1: Class distribution

    plt.figure(figsize=(8, 5))

    plt.bar(
        ["Normal", "Anomalous"],
        [len(normal), len(anomalous)],
        color=["green", "red"]
    )

    plt.title("Authentication Dataset Distribution")
    plt.ylabel("Number of Observations")
    plt.tight_layout()

    plt.savefig(
        REPORT_DIR / "class_distribution.png",
        dpi=150
    )

    plt.close()

    # Chart 2: Failed login distribution

    plt.figure(figsize=(10, 6))

    plt.hist(
        normal["failed_attempts"],
        bins=15,
        alpha=0.7,
        color="green",
        label="Normal"
    )

    plt.hist(
        anomalous["failed_attempts"],
        bins=15,
        alpha=0.7,
        color="red",
        label="Anomalous"
    )

    plt.title("Failed Authentication Attempts")
    plt.xlabel("Failed Attempts")
    plt.ylabel("Frequency")
    plt.legend()
    plt.tight_layout()

    plt.savefig(
        REPORT_DIR / "failed_attempts.png",
        dpi=150
    )

    plt.close()

    # Chart 3: Authentication behaviour

    plt.figure(figsize=(10, 6))

    plt.scatter(
        normal["failed_attempts"],
        normal["failure_rate"],
        color="green",
        alpha=0.5,
        label="Normal"
    )

    plt.scatter(
        anomalous["failed_attempts"],
        anomalous["failure_rate"],
        color="red",
        alpha=0.7,
        label="Anomalous"
    )

    plt.title("Authentication Behaviour Analysis")
    plt.xlabel("Failed Attempts")
    plt.ylabel("Failure Rate")
    plt.legend()
    plt.tight_layout()

    plt.savefig(
        REPORT_DIR / "authentication_behavior.png",
        dpi=150
    )

    plt.close()

    print("\nVisualisations generated successfully.")

    print("\nReports saved to:")
    print(REPORT_DIR)


def main():

    df = load_dataset()

    explore_dataset(df)

    generate_visualizations(df)


if __name__ == "__main__":
    main()