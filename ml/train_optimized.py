import json
import joblib
import matplotlib.pyplot as plt

from pathlib import Path
from sklearn.ensemble import IsolationForest
from sklearn.metrics import ConfusionMatrixDisplay

from ml.prepare_data import prepare_data, FEATURE_COLUMNS
from ml.train_model import evaluate_model


# ==============================
# CONFIGURATION
# ==============================

BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_DIR = BASE_DIR / "models"
REPORT_DIR = BASE_DIR / "reports"

RANDOM_STATE = 42

BEST_ESTIMATORS = 100
BEST_CONTAMINATION = 0.01


# ==============================
# OPTIMISED MODEL
# ==============================

def train_optimized_model(X_train):

    model = IsolationForest(
        n_estimators=BEST_ESTIMATORS,
        contamination=BEST_CONTAMINATION,
        random_state=RANDOM_STATE,
        n_jobs=1
    )

    model.fit(X_train)

    return model


# ==============================
# PERFORMANCE COMPARISON
# ==============================

def compare_models(optimized_metrics):

    baseline_path = REPORT_DIR / "model_metrics.json"

    if not baseline_path.exists():

        print("Baseline metrics not found.")
        return

    with open(
        baseline_path,
        "r",
        encoding="utf-8"
    ) as file:

        baseline = json.load(file)

    print("\nMODEL PERFORMANCE COMPARISON")
    print("=" * 60)

    print(
        f"{'Metric':<15}"
        f"{'Baseline':>12}"
        f"{'Optimised':>12}"
        f"{'Difference':>15}"
    )

    for metric, new_value in optimized_metrics.items():

        old_value = baseline[metric]

        difference = (new_value - old_value) * 100

        print(
            f"{metric:<15}"
            f"{old_value:>11.2%}"
            f"{new_value:>11.2%}"
            f"{difference:>12.2f} pp"
        )


# ==============================
# SAVE MODEL AND REPORTS
# ==============================

def save_results(model, metrics, matrix):

    MODEL_DIR.mkdir(exist_ok=True)
    REPORT_DIR.mkdir(exist_ok=True)

    artifact = {
        "model": model,
        "features": FEATURE_COLUMNS,
        "parameters": {
            "n_estimators": BEST_ESTIMATORS,
            "contamination": BEST_CONTAMINATION
        }
    }

    model_path = (
        MODEL_DIR / "isolation_forest_optimized.joblib"
    )

    joblib.dump(artifact, model_path)

    metrics_path = (
        REPORT_DIR / "optimized_model_metrics.json"
    )

    with open(
        metrics_path,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(metrics, file, indent=4)

    display = ConfusionMatrixDisplay(
        confusion_matrix=matrix,
        display_labels=["Normal", "Anomalous"]
    )

    display.plot(cmap="Blues")

    plt.title("Sentinel AI - Optimised Confusion Matrix")
    plt.tight_layout()

    plt.savefig(
        REPORT_DIR / "optimized_confusion_matrix.png",
        dpi=150
    )

    plt.close()

    print("\nOptimised model saved to:")
    print(model_path)

    print("\nEvaluation reports saved successfully.")


# ==============================
# MAIN PIPELINE
# ==============================

def main():

    print("=" * 50)
    print("SENTINEL AI - OPTIMISED MODEL TRAINING")
    print("=" * 50)

    X_train, X_test, y_test = prepare_data()

    print("\nTraining observations:", len(X_train))
    print("Testing observations:", len(X_test))

    print("\nSelected Configuration:")
    print("Number of trees:", BEST_ESTIMATORS)
    print("Contamination:", BEST_CONTAMINATION)

    print("\nTraining optimised model...")

    model = train_optimized_model(X_train)

    print("Training completed.")

    metrics, matrix = evaluate_model(
        model,
        X_test,
        y_test
    )

    compare_models(metrics)

    save_results(model, metrics, matrix)

    print("\nOptimisation pipeline completed.")


if __name__ == "__main__":
    main()