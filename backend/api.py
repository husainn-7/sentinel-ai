
from contextlib import asynccontextmanager

from fastapi import (
    FastAPI,
    HTTPException,
    Depends,
)

from fastapi.responses import StreamingResponse

from backend.schemas import (
    ChatRequest,
    ChatResponse,
    PhishingRequest,
    LogRequest,
    AnomalyRequest,
    AnalysisResponse,
    HealthResponse,
)

from backend.ai_service import (
    MODEL,
    chat,
    generate_phishing_report,
    generate_log_report,
    generate_anomaly_report,
)

from backend.streaming import (
    stream_chat_response,
)

from backend.history_router import (
    router as history_router,
    get_database_path,
)

from backend.persistent_chat import (
    prepare_chat_session,
    complete_chat_session,
    ConversationNotFoundError,
    InvalidConversationRequestError,
)

from backend.persistent_investigation import (
    build_investigation_response,
)

from database.db import (
    initialize_database,
)

from security.risk_engine import (
    analyze_email,
)

from security.log_engine import (
    analyze_security_logs,
)

from ml.predict_anomaly import (
    predict_anomalies,
)


# =========================================
# APPLICATION LIFECYCLE
# =========================================

@asynccontextmanager
async def lifespan(app: FastAPI):

    database_provider = app.dependency_overrides.get(
        get_database_path,
        get_database_path,
    )

    initialize_database(
        database_provider()
    )

    yield


# =========================================
# APPLICATION CONFIGURATION
# =========================================

app = FastAPI(

    title="Sentinel AI API",

    description=(
        "Local AI-powered cybersecurity assistant "
        "with machine learning, security analysis "
        "and persistent SQLite history."
    ),

    version="0.6.0",

    lifespan=lifespan,

)


# =========================================
# REGISTER HISTORY ROUTER
# =========================================

app.include_router(history_router)


# =========================================
# CHAT SESSION PREPARATION
# =========================================

def resolve_chat_session(
    request,
    db_path
):

    try:

        return prepare_chat_session(

            request,

            db_path=db_path,

        )

    except ConversationNotFoundError as exception:

        raise HTTPException(

            status_code=404,

            detail="Saved conversation not found.",

        ) from exception

    except InvalidConversationRequestError as exception:

        raise HTTPException(

            status_code=400,

            detail=str(exception),

        ) from exception

    except Exception as exception:

        raise HTTPException(

            status_code=503,

            detail=(
                "Conversation storage is unavailable."
            ),

        ) from exception


# =========================================
# ROOT ENDPOINT
# =========================================

@app.get("/")
def root():

    return {

        "application": "Sentinel AI",

        "version": "0.6.0",

        "status": "running",

        "message": "Sentinel AI API is operational.",

    }


# =========================================
# HEALTH ENDPOINT
# =========================================

@app.get(
    "/health",
    response_model=HealthResponse
)
def health():

    return {

        "status": "healthy",

        "service": "Sentinel AI Backend",

    }


# =========================================
# AI CHAT ENDPOINT
# =========================================

@app.post(

    "/chat",

    response_model=ChatResponse,

    response_model_exclude_unset=True,

)
def chat_endpoint(

    request: ChatRequest,

    db_path=Depends(get_database_path),

):

    session = resolve_chat_session(

        request,

        db_path,

    )

    try:

        if session.save_history:

            response = chat(

                session.message,

                session.history,

            )

        else:

            response = chat(

                request.message,

                request.history,

            )

    except Exception as exception:

        raise HTTPException(

            status_code=503,

            detail=(
                "AI service unavailable. "
                "Check Ollama."
            ),

        ) from exception


    result = {

        "response": response,

        "model": MODEL,

    }


    if session.save_history:

        storage_metadata = complete_chat_session(

            session,

            response,

        )

        result.update(
            storage_metadata
        )


    return result


# =========================================
# STREAMING AI CHAT ENDPOINT
# =========================================

@app.post("/chat/stream")
def chat_stream_endpoint(

    request: ChatRequest,

    db_path=Depends(get_database_path),

):

    session = resolve_chat_session(

        request,

        db_path,

    )


    if session.save_history:

        response_stream = stream_chat_response(

            session.message,

            session.history,

            session=session,

        )

    else:

        response_stream = stream_chat_response(

            request.message,

            request.history,

        )


    return StreamingResponse(

        response_stream,

        media_type="text/event-stream",

        headers={

            "Cache-Control": "no-cache",

            "X-Accel-Buffering": "no",

        },

    )


# =========================================
# PHISHING ANALYSIS ENDPOINT
# =========================================

@app.post(

    "/phishing",

    response_model=AnalysisResponse,

    response_model_exclude_unset=True,

)
def phishing_endpoint(

    request: PhishingRequest,

    db_path=Depends(get_database_path),

):

    try:

        analysis = analyze_email(

            request.email_text

        )

    except Exception as exception:

        raise HTTPException(

            status_code=500,

            detail="Phishing analysis failed.",

        ) from exception


    ai_report = None

    analysis_status = "success"


    if request.include_ai_report:

        try:

            ai_report = generate_phishing_report(

                analysis

            )

        except Exception:

            analysis_status = (
                "analysis_completed_ai_unavailable"
            )


    return build_investigation_response(

        investigation_type="phishing",

        request=request,

        analysis=analysis,

        analysis_status=analysis_status,

        ai_report=ai_report,

        db_path=db_path,

    )


# =========================================
# SECURITY LOG ANALYSIS ENDPOINT
# =========================================

@app.post(

    "/logs",

    response_model=AnalysisResponse,

    response_model_exclude_unset=True,

)
def logs_endpoint(

    request: LogRequest,

    db_path=Depends(get_database_path),

):

    try:

        analysis = analyze_security_logs(

            request.log_text

        )

    except Exception as exception:

        raise HTTPException(

            status_code=500,

            detail="Security log analysis failed.",

        ) from exception


    if analysis["summary"]["total_events"] == 0:

        return build_investigation_response(

            investigation_type="logs",

            request=request,

            analysis=analysis,

            analysis_status="no_valid_events",

            ai_report=None,

            db_path=db_path,

        )


    ai_report = None

    analysis_status = "success"


    if request.include_ai_report:

        try:

            ai_report = generate_log_report(

                analysis

            )

        except Exception:

            analysis_status = (
                "analysis_completed_ai_unavailable"
            )


    return build_investigation_response(

        investigation_type="logs",

        request=request,

        analysis=analysis,

        analysis_status=analysis_status,

        ai_report=ai_report,

        db_path=db_path,

    )


# =========================================
# MACHINE LEARNING ANOMALY ENDPOINT
# =========================================

@app.post(

    "/anomaly",

    response_model=AnalysisResponse,

    response_model_exclude_unset=True,

)
def anomaly_endpoint(

    request: AnomalyRequest,

    db_path=Depends(get_database_path),

):

    try:

        analysis = predict_anomalies(

            request.log_text

        )

    except FileNotFoundError as exception:

        raise HTTPException(

            status_code=503,

            detail=(
                "Trained anomaly detection "
                "model is unavailable."
            ),

        ) from exception

    except Exception as exception:

        raise HTTPException(

            status_code=500,

            detail="Anomaly detection failed.",

        ) from exception


    if analysis["total_windows"] == 0:

        return build_investigation_response(

            investigation_type="anomaly",

            request=request,

            analysis=analysis,

            analysis_status="no_valid_windows",

            ai_report=None,

            db_path=db_path,

        )


    ai_report = None

    analysis_status = "success"


    if request.include_ai_report:

        try:

            ai_report = generate_anomaly_report(

                analysis

            )

        except Exception:

            analysis_status = (
                "analysis_completed_ai_unavailable"
            )


    return build_investigation_response(

        investigation_type="anomaly",

        request=request,

        analysis=analysis,

        analysis_status=analysis_status,

        ai_report=ai_report,

        db_path=db_path,

    )
