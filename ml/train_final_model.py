import json
import joblib
import pandas as pd
import matplotlib.pyplot as plt

from pathlib import Path

from sklearn.ensemble import IsolationForest

from sklearn.metrics import (
    confusion_matrix,
    ConfusionMatrixDisplay,
    classification_report
)

from ml.prepare_data import FEATURE_COLUMNS
from ml.prepare_data_v2 import prepare_data
from ml.tune_model_v2 import calculate_metrics


# ==============================
# CONFIGURATION
# ==============================

BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_DIR = BASE_DIR / "models"
REPORT_DIR = BASE_DIR / "reports"

CONFIG_PATH = (
    REPORT_DIR / "best_configuration_v2.json"
)

RANDOM_STATE = 42


# ==============================
# LOAD BEST CONFIGURATION
# ==============================

def load_configuration():

    with open(
        CONFIG_PATH,
        "r",
        encoding="utf-8"
    ) as file:

        return json.load(file)


# ==============================
# TRAIN FINAL MODEL
# ==============================

def train_final_model(X_train, config):

    model = IsolationForest(
        n_estimators=config["n_estimators"],
        contamination=config["contamination"],
        random_state=RANDOM_STATE,
        n_jobs=1
    )

    model.fit(X_train)

    return model


# ==============================
# RULE-BASED BASELINE
# ==============================

def rule_based_prediction(X):

    return (
        X["failed_attempts"] >= 5
    ).astype(int)


# ==============================
# EVALUATE MODELS
# ==============================

def evaluate_models(model, X_test, y_test):

    ml_predictions = (
        model.predict(X_test) == -1
    ).astype(int)

    rule_predictions = rule_based_prediction(
        X_test
    )

    ml_metrics = calculate_metrics(
        y_test,
        ml_predictions
    )

    rule_metrics = calculate_metrics(
        y_test,
        rule_predictions
    )

    results = pd.DataFrame([
        {
            "model": "Isolation Forest",
            **ml_metrics
        },
        {
            "model": "Rule-based",
            **rule_metrics
        }
    ])

    print("\nFINAL TEST RESULTS")
    print("=" * 70)

    print(
        results.round(4).to_string(index=False)
    )

    print("\nISOLATION FOREST CLASSIFICATION REPORT")

    print(
        classification_report(
            y_test,
            ml_predictions,
            labels=[0, 1],
            target_names=["Normal", "Anomalous"],
            zero_division=0
        )
    )

    ml_matrix = confusion_matrix(
        y_test,
        ml_predictions,
        labels=[0, 1]
    )

    rule_matrix = confusion_matrix(
        y_test,
        rule_predictions,
        labels=[0, 1]
    )

    print("\nML Confusion Matrix:")
    print(ml_matrix)

    print("\nRule-Based Confusion Matrix:")
    print(rule_matrix)

    return results, ml_matrix, rule_matrix


# ==============================
# SAVE CONFUSION MATRIX
# ==============================

def save_confusion_matrix(matrix, title, filename):

    display = ConfusionMatrixDisplay(
        confusion_matrix=matrix,
        display_labels=["Normal", "Anomalous"]
    )

    display.plot(cmap="Blues")

    plt.title(title)
    plt.tight_layout()

    plt.savefig(
        REPORT_DIR / filename,
        dpi=150
    )

    plt.close()


# ==============================
# SAVE FINAL ARTIFACTS
# ==============================

def save_artifacts(
    model,
    config,
    results,
    ml_matrix,
    rule_matrix
):

    MODEL_DIR.mkdir(exist_ok=True)
    REPORT_DIR.mkdir(exist_ok=True)

    artifact = {
        "model": model,
        "features": FEATURE_COLUMNS,
        "configuration": config,
        "dataset": "authentication_data_v2",
        "window_seconds": 60
    }

    model_path = (
        MODEL_DIR / "isolation_forest_final.joblib"
    )

    joblib.dump(artifact, model_path)

    results.to_csv(
        REPORT_DIR / "final_model_comparison.csv",
        index=False
    )

    save_confusion_matrix(
        ml_matrix,
        "Sentinel AI - Final Isolation Forest",
        "final_ml_confusion_matrix.png"
    )

    save_confusion_matrix(
        rule_matrix,
        "Sentinel AI - Rule-Based Detection",
        "rule_based_confusion_matrix.png"
    )

    print("\nFinal model saved to:")
    print(model_path)

    print("\nEvaluation reports saved to:")
    print(REPORT_DIR)


# ==============================
# MAIN PIPELINE
# ==============================

def main():

    print("=" * 60)
    print("SENTINEL AI - FINAL MODEL EVALUATION")
    print("=" * 60)

    (
        X_train,
        X_validation,
        y_validation,
        X_test,
        y_test
    ) = prepare_data()

    config = load_configuration()

    print("\nSelected Configuration:")

    print(
        json.dumps(config, indent=4)
    )

    print("\nTraining observations:", len(X_train))
    print("Testing observations:", len(X_test))

    print("\nTraining final model...")

    model = train_final_model(
        X_train,
        config
    )

    print("Training completed.")

    (
        results,
        ml_matrix,
        rule_matrix
    ) = evaluate_models(
        model,
        X_test,
        y_test
    )

    save_artifacts(
        model,
        config,
        results,
        ml_matrix,
        rule_matrix
    )

    print("\nFinal evaluation completed.")


if __name__ == "__main__":
    main()