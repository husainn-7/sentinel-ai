import joblib
import json

import matplotlib.pyplot as plt

from pathlib import Path
from sklearn.ensemble import IsolationForest

from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    classification_report,
    confusion_matrix,
    ConfusionMatrixDisplay
)

from ml.prepare_data import prepare_data, FEATURE_COLUMNS


# ==============================
# CONFIGURATION
# ==============================

RANDOM_STATE = 42

BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_DIR = BASE_DIR / "models"
REPORT_DIR = BASE_DIR / "reports"


# ==============================
# MODEL TRAINING
# ==============================

def train_model(X_train):

    model = IsolationForest(
        n_estimators=100,
        contamination="auto",
        random_state=RANDOM_STATE,
        n_jobs=1
    )

    model.fit(X_train)

    return model


# ==============================
# MODEL EVALUATION
# ==============================

def evaluate_model(model, X_test, y_test):

    predictions = model.predict(X_test)

    # Isolation Forest returns:
    #  1 = Normal
    # -1 = Anomaly

    predictions = (predictions == -1).astype(int)

    accuracy = accuracy_score(y_test, predictions)

    precision = precision_score(
        y_test, predictions, zero_division=0
    )

    recall = recall_score(
        y_test, predictions, zero_division=0
    )

    f1 = f1_score(
        y_test, predictions, zero_division=0
    )

    metrics = {
        "accuracy": float(accuracy),
        "precision": float(precision),
        "recall": float(recall),
        "f1_score": float(f1)
    }

    print("\nMODEL EVALUATION")
    print("=" * 50)

    for name, value in metrics.items():

        print(f"{name}: {value:.4f}")

    print("\nClassification Report:")

    print(
        classification_report(
            y_test,
            predictions,
            labels=[0, 1],
            target_names=["Normal", "Anomalous"],
            zero_division=0
        )
    )

    matrix = confusion_matrix(
        y_test,
        predictions,
        labels=[0, 1]
    )

    print("\nConfusion Matrix:")
    print(matrix)

    return metrics, matrix


# ==============================
# SAVE EVALUATION REPORT
# ==============================

def save_reports(metrics, matrix):

    REPORT_DIR.mkdir(exist_ok=True)

    display = ConfusionMatrixDisplay(
        confusion_matrix=matrix,
        display_labels=["Normal", "Anomalous"]
    )

    display.plot(cmap="Blues")

    plt.title("Sentinel AI - Confusion Matrix")
    plt.tight_layout()

    plt.savefig(
        REPORT_DIR / "confusion_matrix.png",
        dpi=150
    )

    plt.close()

    with open(
        REPORT_DIR / "model_metrics.json",
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(metrics, file, indent=4)

    print("\nEvaluation reports saved.")


# ==============================
# SAVE TRAINED MODEL
# ==============================

def save_model(model):

    MODEL_DIR.mkdir(exist_ok=True)

    model_path = MODEL_DIR / "isolation_forest.joblib"

    artifact = {
        "model": model,
        "features": FEATURE_COLUMNS
    }

    joblib.dump(artifact, model_path)

    print("\nModel saved to:")
    print(model_path)


# ==============================
# MAIN TRAINING PIPELINE
# ==============================

def main():

    print("=" * 50)
    print("SENTINEL AI - MODEL TRAINING")
    print("=" * 50)

    X_train, X_test, y_test = prepare_data()

    print("\nTraining observations:", len(X_train))
    print("Testing observations:", len(X_test))

    print("\nTraining Isolation Forest...")

    model = train_model(X_train)

    print("Model training completed.")

    metrics, matrix = evaluate_model(
        model,
        X_test,
        y_test
    )

    save_reports(metrics, matrix)

    save_model(model)

    print("\nML pipeline completed successfully.")


if __name__ == "__main__":
    main()