
import json
import platform
import sqlite3
import sys

from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter
from urllib.request import urlopen
from importlib.metadata import version, PackageNotFoundError

from backend.config import (
    APP_NAME,
    APP_VERSION,
    DEVELOPMENT_MODE,
    DATABASE_PATH,
    ML_MODEL_PATH,
    ML_MODEL_NAME,
    ML_WINDOW_SECONDS,
    ML_FEATURES,
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
    OLLAMA_TIMEOUT_SECONDS,
    DEFAULT_SAVE_HISTORY,
    DEFAULT_SAVE_INVESTIGATIONS,
)

from database.db import get_database_info


# =========================================
# PACKAGE VERSION INFORMATION
# =========================================

def get_package_version(package_name):

    try:

        return version(package_name)

    except PackageNotFoundError:

        return None


# =========================================
# APPLICATION INFORMATION
# =========================================

def get_application_information():

    return {
        "name": APP_NAME,
        "version": APP_VERSION,
        "development_mode": DEVELOPMENT_MODE,
        "deployment": "local",
    }


# =========================================
# SYSTEM INFORMATION
# =========================================

def get_system_information():

    return {
        "operating_system": platform.system(),
        "os_release": platform.release(),
        "architecture": platform.machine(),
        "python_version": platform.python_version(),
        "sqlite_version": sqlite3.sqlite_version,
        "fastapi_version": get_package_version("fastapi"),
        "scikit_learn_version": get_package_version("scikit-learn"),
        "ollama_client_version": get_package_version("ollama"),
        "python_bits": 64 if sys.maxsize > 2**32 else 32,
    }


# =========================================
# OLLAMA DIAGNOSTICS
# =========================================

def check_ollama():

    start_time = perf_counter()

    result = {
        "status": "unavailable",
        "connected": False,
        "configured_model": OLLAMA_MODEL,
        "model_available": False,
        "available_models": [],
        "latency_ms": None,
        "message": None,
    }

    try:

        with urlopen(
            f"{OLLAMA_BASE_URL}/api/tags",
            timeout=OLLAMA_TIMEOUT_SECONDS,
        ) as response:

            payload = json.loads(response.read())

        models = payload.get("models", [])

        model_names = [
            model.get("name") or model.get("model")
            for model in models
        ]

        model_names = [
            name for name in model_names if name
        ]

        model_available = OLLAMA_MODEL in model_names

        result.update({
            "status": "healthy" if model_available else "degraded",
            "connected": True,
            "model_available": model_available,
            "available_models": model_names,
            "message": (
                "Ollama and the configured model are available."
                if model_available
                else "Ollama is running but the configured model is missing."
            ),
        })

    except Exception:

        result["message"] = (
            "Unable to connect to the local Ollama service."
        )

    finally:

        result["latency_ms"] = round(
            (perf_counter() - start_time) * 1000,
            2,
        )

    return result


# =========================================
# MACHINE LEARNING DIAGNOSTICS
# =========================================

def check_ml_model(model_path=None):

    path = Path(
        model_path if model_path is not None else ML_MODEL_PATH
    )

    result = {
        "status": "unavailable",
        "model_name": ML_MODEL_NAME,
        "filename": path.name,
        "available": False,
        "size_bytes": 0,
        "window_seconds": ML_WINDOW_SECONDS,
        "feature_count": len(ML_FEATURES),
        "features": list(ML_FEATURES),
        "message": None,
    }

    try:

        if not path.is_file():

            result["message"] = "Trained model file was not found."

            return result

        size_bytes = path.stat().st_size

        if size_bytes == 0:

            result["message"] = "Trained model file is empty."

            return result

        result.update({
            "status": "available",
            "available": True,
            "size_bytes": size_bytes,
            "message": "Trained model file is present.",
        })

    except OSError:

        result["message"] = "Unable to inspect the trained model file."

    return result


# =========================================
# DATABASE DIAGNOSTICS
# =========================================

def check_database(db_path=None):

    path = Path(
        db_path if db_path is not None else DATABASE_PATH
    )

    result = {
        "status": "unavailable",
        "available": False,
        "integrity": None,
        "schema_version": None,
        "sqlite_version": sqlite3.sqlite_version,
        "size_bytes": 0,
        "tables": [],
        "message": None,
    }

    try:

        if not path.is_file():

            result["message"] = "SQLite database was not found."

            return result

        info = get_database_info(path)

        integrity = info.get("integrity")

        result.update({
            "status": (
                "healthy" if integrity == "ok" else "degraded"
            ),
            "available": True,
            "integrity": integrity,
            "schema_version": info.get("schema_version"),
            "sqlite_version": info.get(
                "sqlite_version",
                sqlite3.sqlite_version,
            ),
            "size_bytes": info.get("size_bytes", 0),
            "tables": info.get("tables", []),
            "message": (
                "Database integrity check passed."
                if integrity == "ok"
                else "Database integrity requires attention."
            ),
        })

    except Exception:

        result["message"] = "Unable to inspect the SQLite database."

    return result


# =========================================
# PRIVACY INFORMATION
# =========================================

def get_privacy_information():

    return {
        "local_processing": True,
        "external_ai_api_required": False,
        "database_encrypted": False,
        "conversation_storage_default": DEFAULT_SAVE_HISTORY,
        "investigation_storage_default": DEFAULT_SAVE_INVESTIGATIONS,
        "storage_mode": "opt-in",
        "message": (
            "Saved conversations and investigations "
            "are stored in an unencrypted local SQLite database."
        ),
    }


# =========================================
# COMPLETE SYSTEM DIAGNOSTICS
# =========================================

def get_system_diagnostics(db_path=None):

    start_time = perf_counter()

    ollama = check_ollama()

    ml_model = check_ml_model()

    database = check_database(db_path)

    all_services_available = (
        ollama["status"] == "healthy"
        and ml_model["available"]
        and database["status"] == "healthy"
    )

    return {
        "status": (
            "healthy" if all_services_available else "degraded"
        ),
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "application": get_application_information(),
        "system": get_system_information(),
        "services": {
            "backend": {
                "status": "healthy",
                "available": True,
            },
            "ollama": ollama,
            "machine_learning": ml_model,
            "database": database,
        },
        "privacy": get_privacy_information(),
        "diagnostics_duration_ms": round(
            (perf_counter() - start_time) * 1000,
            2,
        ),
    }
