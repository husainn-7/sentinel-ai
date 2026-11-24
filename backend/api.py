from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse

from backend.schemas import (
    ChatRequest,
    ChatResponse,
    HealthResponse,
    PhishingRequest,
    LogRequest,
    AnomalyRequest,
    AnalysisResponse
)

from backend.ai_service import (
    chat,
    MODEL,
    generate_phishing_report,
    generate_log_report,
    generate_anomaly_report
)

from backend.streaming import stream_chat_response

from security.risk_engine import analyze_email
from security.log_engine import analyze_security_logs
from ml.predict_anomaly import predict_anomalies


# ==============================
# API CONFIGURATION
# ==============================

app = FastAPI(
    title="Sentinel AI API",
    description="Local AI-powered cybersecurity assistant",
    version="0.5.0"
)


# ==============================
# ROOT ENDPOINT
# ==============================

@app.get("/")
def root():

    return {
        "application": "Sentinel AI",
        "version": "0.5.0",
        "status": "online",
        "message": "Welcome to Sentinel AI API"
    }


# ==============================
# HEALTH CHECK
# ==============================

@app.get("/health", response_model=HealthResponse)
def health_check():

    return {
        "status": "healthy",
        "service": "Sentinel AI Backend"
    }


# ==============================
# CHAT ENDPOINT
# ==============================

@app.post("/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest):

    try:

        response = chat(request.message)

        return ChatResponse(
            response=response,
            model=MODEL
        )

    except Exception as error:

        raise HTTPException(
            status_code=503,
            detail="AI service unavailable. Check Ollama."
        ) from error


# ==============================
# STREAMING CHAT ENDPOINT
# ==============================

@app.post("/chat/stream")
def streaming_chat_endpoint(request: ChatRequest):

    return StreamingResponse(
        stream_chat_response(request.message),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )


# ==============================
# PHISHING ENDPOINT
# ==============================

@app.post("/phishing", response_model=AnalysisResponse)
def phishing_endpoint(request: PhishingRequest):

    analysis = analyze_email(request.email_text)

    ai_report = None
    status = "success"

    if request.include_ai_report:

        try:

            ai_report = generate_phishing_report(
                analysis
            )

        except Exception:

            status = "analysis_completed_ai_unavailable"

    return AnalysisResponse(
        status=status,
        analysis=analysis,
        ai_report=ai_report
    )


# ==============================
# SECURITY LOG ENDPOINT
# ==============================

@app.post("/logs", response_model=AnalysisResponse)
def logs_endpoint(request: LogRequest):

    analysis = analyze_security_logs(
        request.log_text
    )

    ai_report = None
    status = "success"

    if analysis["summary"]["total_events"] == 0:

        return AnalysisResponse(
            status="no_valid_events",
            analysis=analysis,
            ai_report=None
        )

    if request.include_ai_report:

        try:

            ai_report = generate_log_report(
                analysis
            )

        except Exception:

            status = "analysis_completed_ai_unavailable"

    return AnalysisResponse(
        status=status,
        analysis=analysis,
        ai_report=ai_report
    )


# ==============================
# ML ANOMALY ENDPOINT
# ==============================

@app.post("/anomaly", response_model=AnalysisResponse)
def anomaly_endpoint(request: AnomalyRequest):

    try:

        analysis = predict_anomalies(
            request.log_text
        )

    except FileNotFoundError as error:

        raise HTTPException(
            status_code=503,
            detail="Trained ML model unavailable."
        ) from error

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail="Anomaly analysis failed."
        ) from error

    ai_report = None
    status = "success"

    if analysis["total_windows"] == 0:

        return AnalysisResponse(
            status="no_valid_windows",
            analysis=analysis,
            ai_report=None
        )

    if request.include_ai_report:

        try:

            ai_report = generate_anomaly_report(
                analysis
            )

        except Exception:

            status = "analysis_completed_ai_unavailable"

    return AnalysisResponse(
        status=status,
        analysis=analysis,
        ai_report=ai_report
    )