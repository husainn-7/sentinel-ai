import json
import pandas as pd

from pathlib import Path
from sklearn.ensemble import IsolationForest

from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix
)

from ml.prepare_data_v2 import prepare_data


# ==============================
# CONFIGURATION
# ==============================

RANDOM_STATE = 42

BASE_DIR = Path(__file__).resolve().parent.parent
REPORT_DIR = BASE_DIR / "reports"

ESTIMATORS = [100, 200, 300]

CONTAMINATIONS = [
    0.01,
    0.03,
    0.05,
    0.10,
    0.15,
    "auto"
]


# ==============================
# VALIDATION METRICS
# ==============================

def calculate_metrics(y_true, predictions):

    tn, fp, fn, tp = confusion_matrix(
        y_true,
        predictions,
        labels=[0, 1]
    ).ravel()

    false_positive_rate = (
        fp / (fp + tn) if (fp + tn) else 0
    )

    return {
        "accuracy": float(
            accuracy_score(y_true, predictions)
        ),

        "precision": float(
            precision_score(
                y_true, predictions, zero_division=0
            )
        ),

        "recall": float(
            recall_score(
                y_true, predictions, zero_division=0
            )
        ),

        "f1_score": float(
            f1_score(
                y_true, predictions, zero_division=0
            )
        ),

        "false_positive_rate": float(
            false_positive_rate
        )
    }


# ==============================
# HYPERPARAMETER OPTIMISATION
# ==============================

def tune_model(X_train, X_validation, y_validation):

    results = []

    total_configurations = (
        len(ESTIMATORS) * len(CONTAMINATIONS)
    )

    current = 0

    for estimators in ESTIMATORS:

        for contamination in CONTAMINATIONS:

            current += 1

            print(
                f"[{current}/{total_configurations}] "
                f"Trees: {estimators}, "
                f"Contamination: {contamination}"
            )

            model = IsolationForest(
                n_estimators=estimators,
                contamination=contamination,
                random_state=RANDOM_STATE,
                n_jobs=1
            )

            model.fit(X_train)

            raw_predictions = model.predict(
                X_validation
            )

            predictions = (
                raw_predictions == -1
            ).astype(int)

            metrics = calculate_metrics(
                y_validation,
                predictions
            )

            results.append({
                "n_estimators": estimators,
                "contamination": contamination,
                **metrics
            })

    results_df = pd.DataFrame(results)

    # Prioritise F1-score, followed by recall
    # and lower false-positive rates

    results_df = results_df.sort_values(
        by=[
            "f1_score",
            "recall",
            "false_positive_rate",
            "n_estimators"
        ],
        ascending=[False, False, True, True]
    ).reset_index(drop=True)

    return results_df


# ==============================
# SAVE OPTIMISATION RESULTS
# ==============================

def save_results(results):

    REPORT_DIR.mkdir(exist_ok=True)

    results.to_csv(
        REPORT_DIR / "tuning_results_v2.csv",
        index=False
    )

    best = results.iloc[0]

    contamination = best["contamination"]

    if contamination != "auto":
        contamination = float(contamination)

    best_configuration = {
        "n_estimators": int(best["n_estimators"]),
        "contamination": contamination,
        "validation_accuracy": float(best["accuracy"]),
        "validation_precision": float(best["precision"]),
        "validation_recall": float(best["recall"]),
        "validation_f1_score": float(best["f1_score"]),
        "validation_false_positive_rate": float(
            best["false_positive_rate"]
        )
    }

    output_path = (
        REPORT_DIR / "best_configuration_v2.json"
    )

    with open(
        output_path,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            best_configuration,
            file,
            indent=4
        )

    print("\nOptimisation results saved to:")
    print(REPORT_DIR)


# ==============================
# MAIN PIPELINE
# ==============================

def main():

    print("=" * 60)
    print("SENTINEL AI - BALANCED MODEL OPTIMISATION")
    print("=" * 60)

    (
        X_train,
        X_validation,
        y_validation,
        _,
        _
    ) = prepare_data()

    print("\nTraining observations:", len(X_train))
    print("Validation observations:", len(X_validation))

    print("\nStarting balanced hyperparameter tuning...\n")

    results = tune_model(
        X_train,
        X_validation,
        y_validation
    )

    print("\nCONFIGURATION RESULTS")
    print("=" * 60)

    print(
        results.round(4).to_string(index=False)
    )

    print("\nBEST CONFIGURATION")
    print("=" * 60)

    print(results.iloc[0].to_string())

    save_results(results)

    print("\nBalanced optimisation completed.")


if __name__ == "__main__":
    main()