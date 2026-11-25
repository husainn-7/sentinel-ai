
from pathlib import Path


# =========================================
# APPLICATION INFORMATION
# =========================================

APP_NAME = "Sentinel AI"

APP_VERSION = "1.0.0"

APP_DESCRIPTION = (
    "Local AI-powered cybersecurity intelligence "
    "platform with machine learning, threat analysis "
    "and persistent investigation history."
)

DEVELOPMENT_MODE = False


# =========================================
# PROJECT PATHS
# =========================================

BASE_DIR = Path(__file__).resolve().parent.parent

DATABASE_DIR = BASE_DIR / "database"

DATABASE_PATH = DATABASE_DIR / "sentinel.db"

MODELS_DIR = BASE_DIR / "models"

ML_MODEL_PATH = MODELS_DIR / "isolation_forest_final.joblib"


# =========================================
# LOCAL AI CONFIGURATION
# =========================================

OLLAMA_BASE_URL = "http://127.0.0.1:11434"

OLLAMA_MODEL = "llama3.2:latest"

OLLAMA_TIMEOUT_SECONDS = 3


# =========================================
# MACHINE LEARNING CONFIGURATION
# =========================================

ML_MODEL_NAME = "Isolation Forest"

ML_WINDOW_SECONDS = 60

ML_FEATURES = (
    "failed_attempts",
    "successful_attempts",
    "total_attempts",
    "unique_usernames",
    "failure_rate",
)


# =========================================
# SERVER CONFIGURATION
# =========================================

API_HOST = "127.0.0.1"

API_PORT = 8000


# =========================================
# SECURITY CONFIGURATION
# =========================================

MAX_REQUEST_BODY_BYTES = 1024 * 1024

TRUSTED_HOSTS = (
    "localhost",
    "127.0.0.1",
    "[::1]",
)

TRUSTED_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
)

STATE_CHANGING_METHODS = (
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
)

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": (
        "camera=(), microphone=(), geolocation=()"
    ),
    "Cross-Origin-Resource-Policy": "same-origin",
    "Cache-Control": "no-store",
}


# =========================================
# PRIVACY DEFAULTS
# =========================================

DEFAULT_SAVE_HISTORY = False

DEFAULT_SAVE_INVESTIGATIONS = False
