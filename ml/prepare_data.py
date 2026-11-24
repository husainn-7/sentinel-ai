import pandas as pd

from pathlib import Path
from sklearn.model_selection import train_test_split


BASE_DIR = Path(__file__).resolve().parent.parent

DATA_PATH = BASE_DIR / "data" / "authentication_data.csv"

RANDOM_STATE = 42

FEATURE_COLUMNS = [
    "failed_attempts",
    "successful_attempts",
    "total_attempts",
    "unique_usernames",
    "failure_rate"
]


def prepare_data():

    df = pd.read_csv(DATA_PATH)

    original_size = len(df)

    # Remove identical observations before splitting
    df = df.drop_duplicates().reset_index(drop=True)

    print("Original observations:", original_size)
    print("Duplicates removed:", original_size - len(df))
    print("Unique observations:", len(df))

    # Separate features from evaluation labels
    X = df[FEATURE_COLUMNS]
    y = df["label"]

    # Create independent training and testing sets
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.30,
        random_state=RANDOM_STATE,
        stratify=y
    )

    # Train only on known normal observations
    X_train_normal = X_train.loc[y_train == 0].copy()

    return X_train_normal, X_test, y_test


def main():

    print("=" * 50)
    print("SENTINEL AI - FEATURE PREPARATION")
    print("=" * 50)

    X_train, X_test, y_test = prepare_data()

    print("\nSelected Features:")

    for feature in FEATURE_COLUMNS:
        print("-", feature)

    print("\nTraining Dataset:")

    print("Shape:", X_train.shape)
    print("Normal observations:", len(X_train))

    print("\nTesting Dataset:")

    print("Shape:", X_test.shape)

    print("Normal observations:", (y_test == 0).sum())
    print("Anomalous observations:", (y_test == 1).sum())

    print("\nMissing values in training data:")
    print(X_train.isnull().sum())

    print("\nFeature preparation completed successfully.")


if __name__ == "__main__":
    main()