import pandas as pd

from sklearn.ensemble import IsolationForest
from sklearn.model_selection import KFold

from ml.prepare_data import prepare_data


RANDOM_STATE = 42

ESTIMATORS = [100, 200, 300]

CONTAMINATIONS = [
    0.01,
    0.03,
    0.05,
    0.10,
    0.15,
    "auto"
]


def tune_model(X_train):

    results = []

    cv = KFold(
        n_splits=5,
        shuffle=True,
        random_state=RANDOM_STATE
    )

    for estimators in ESTIMATORS:

        for contamination in CONTAMINATIONS:

            false_positive_rates = []

            for train_index, val_index in cv.split(X_train):

                training_data = X_train.iloc[train_index]
                validation_data = X_train.iloc[val_index]

                model = IsolationForest(
                    n_estimators=estimators,
                    contamination=contamination,
                    random_state=RANDOM_STATE,
                    n_jobs=1
                )

                model.fit(training_data)

                predictions = model.predict(validation_data)

                false_positive_rate = (
                    predictions == -1
                ).mean()

                false_positive_rates.append(
                    false_positive_rate
                )

            average_fpr = (
                sum(false_positive_rates)
                / len(false_positive_rates)
            )

            results.append({
                "n_estimators": estimators,
                "contamination": contamination,
                "false_positive_rate": average_fpr,
                "normal_detection_rate": 1 - average_fpr
            })

    results_df = pd.DataFrame(results)

    results_df = results_df.sort_values(
        by="false_positive_rate"
    ).reset_index(drop=True)

    return results_df


def main():

    print("=" * 50)
    print("SENTINEL AI - MODEL OPTIMISATION")
    print("=" * 50)

    X_train, X_test, y_test = prepare_data()

    print("\nStarting hyperparameter tuning...")

    results = tune_model(X_train)

    print("\nConfiguration Results:")

    print(results.to_string(index=False))

    print("\nBest Configuration:")

    print(results.iloc[0].to_string())

    print("\nModel optimisation completed.")


if __name__ == "__main__":
    main()