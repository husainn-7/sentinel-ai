import pandas as pd

from pathlib import Path
from sklearn.model_selection import GroupShuffleSplit

from ml.prepare_data import FEATURE_COLUMNS


# ==============================
# CONFIGURATION
# ==============================

RANDOM_STATE = 42

BASE_DIR = Path(__file__).resolve().parent.parent

DATA_PATH = BASE_DIR / "data" / "authentication_data_v2.csv"


# ==============================
# DATA PREPARATION
# ==============================

def prepare_data():

    df = pd.read_csv(DATA_PATH)

    print("Total observations:", len(df))

    # Assign identical feature combinations
    # to the same group

    groups = pd.util.hash_pandas_object(
        df[FEATURE_COLUMNS],
        index=False
    )

    # First split: 60% training, 40% remaining

    first_split = GroupShuffleSplit(
        n_splits=1,
        train_size=0.60,
        random_state=RANDOM_STATE
    )

    train_index, remaining_index = next(
        first_split.split(df, groups=groups)
    )

    train_df = df.iloc[train_index].copy()

    remaining_df = df.iloc[remaining_index].copy()

    remaining_groups = groups.iloc[remaining_index]

    # Second split: divide remaining groups
    # into validation and testing sets

    second_split = GroupShuffleSplit(
        n_splits=1,
        train_size=0.50,
        random_state=RANDOM_STATE
    )

    validation_index, test_index = next(
        second_split.split(
            remaining_df,
            groups=remaining_groups
        )
    )

    validation_df = remaining_df.iloc[
        validation_index
    ].copy()

    test_df = remaining_df.iloc[
        test_index
    ].copy()

    # Isolation Forest learns normal behaviour only

    normal_train_df = train_df[
        train_df["label"] == 0
    ].copy()

    X_train = normal_train_df[FEATURE_COLUMNS]

    X_validation = validation_df[FEATURE_COLUMNS]
    y_validation = validation_df["label"]

    X_test = test_df[FEATURE_COLUMNS]
    y_test = test_df["label"]

    # Verify no identical feature combinations
    # appear in different datasets

    train_groups = set(
        groups.iloc[train_index]
    )

    validation_groups = set(
        remaining_groups.iloc[validation_index]
    )

    test_groups = set(
        remaining_groups.iloc[test_index]
    )

    assert train_groups.isdisjoint(
        validation_groups
    )

    assert train_groups.isdisjoint(
        test_groups
    )

    assert validation_groups.isdisjoint(
        test_groups
    )

    print("Data leakage check: Passed")

    return (
        X_train,
        X_validation,
        y_validation,
        X_test,
        y_test
    )


# ==============================
# DATASET SUMMARY
# ==============================

def main():

    print("=" * 50)
    print("SENTINEL AI - ADVANCED DATA PREPARATION")
    print("=" * 50)

    (
        X_train,
        X_validation,
        y_validation,
        X_test,
        y_test
    ) = prepare_data()

    print("\nTRAINING DATASET")
    print("Shape:", X_train.shape)
    print("Normal observations:", len(X_train))

    print("\nVALIDATION DATASET")
    print("Shape:", X_validation.shape)

    print(
        "Normal observations:",
        (y_validation == 0).sum()
    )

    print(
        "Anomalous observations:",
        (y_validation == 1).sum()
    )

    print("\nTESTING DATASET")
    print("Shape:", X_test.shape)

    print(
        "Normal observations:",
        (y_test == 0).sum()
    )

    print(
        "Anomalous observations:",
        (y_test == 1).sum()
    )

    print("\nAdvanced data preparation completed.")


if __name__ == "__main__":
    main()