
from fastapi import APIRouter, Depends, Response

from backend.history_router import get_database_path

from backend.system_service import (
    get_application_information,
    get_system_information,
    get_system_diagnostics,
    get_privacy_information,
    check_ollama,
    check_ml_model,
    check_database,
)


# =========================================
# ROUTER CONFIGURATION
# =========================================

router = APIRouter(
    prefix="/system",
    tags=["System Management"],
)


# =========================================
# COMPLETE SYSTEM DIAGNOSTICS
# =========================================

@router.get("/diagnostics")
def system_diagnostics(
    response: Response,
    db_path=Depends(get_database_path),
):

    response.headers["Cache-Control"] = "no-store"

    return get_system_diagnostics(
        db_path=db_path
    )


# =========================================
# APPLICATION INFORMATION
# =========================================

@router.get("/application")
def application_information():

    return get_application_information()


# =========================================
# SYSTEM ENVIRONMENT
# =========================================

@router.get("/environment")
def system_environment():

    return get_system_information()


# =========================================
# OLLAMA STATUS
# =========================================

@router.get("/ollama")
def ollama_status(response: Response):

    response.headers["Cache-Control"] = "no-store"

    return check_ollama()


# =========================================
# MACHINE LEARNING STATUS
# =========================================

@router.get("/model")
def model_status(response: Response):

    response.headers["Cache-Control"] = "no-store"

    return check_ml_model()


# =========================================
# DATABASE STATUS
# =========================================

@router.get("/database")
def database_status(
    response: Response,
    db_path=Depends(get_database_path),
):

    response.headers["Cache-Control"] = "no-store"

    return check_database(
        db_path=db_path
    )


# =========================================
# PRIVACY INFORMATION
# =========================================

@router.get("/privacy")
def privacy_information():

    return get_privacy_information()
