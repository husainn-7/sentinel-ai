
from typing import Any, Literal

from pydantic import BaseModel, Field, ConfigDict


# ==============================
# BASE REQUEST CONFIGURATION
# ==============================

class BaseRequest(BaseModel):

    model_config = ConfigDict(
        str_strip_whitespace=True,
        extra="forbid"
    )


# ==============================
# CONVERSATION MEMORY SCHEMA
# ==============================

class ConversationMessage(BaseRequest):

    role: Literal["user", "assistant"]

    content: str = Field(
        ...,
        min_length=1,
        max_length=8000,
        description="Previous conversation message"
    )


# ==============================
# CHAT SCHEMAS
# ==============================

class ChatRequest(BaseRequest):

    message: str = Field(
        ...,
        min_length=1,
        max_length=4000,
        description="Cybersecurity question"
    )

    history: list[ConversationMessage] = Field(
        default_factory=list,
        max_length=6,
        description="Recent conversation history"
    )


class ChatResponse(BaseModel):

    response: str
    model: str


# ==============================
# PHISHING SCHEMAS
# ==============================

class PhishingRequest(BaseRequest):

    email_text: str = Field(
        ...,
        min_length=1,
        max_length=20000,
        description="Suspicious email content"
    )

    include_ai_report: bool = True


# ==============================
# SECURITY LOG SCHEMAS
# ==============================

class LogRequest(BaseRequest):

    log_text: str = Field(
        ...,
        min_length=1,
        max_length=100000,
        description="SSH authentication logs"
    )

    include_ai_report: bool = True


# ==============================
# ANOMALY DETECTION SCHEMAS
# ==============================

class AnomalyRequest(BaseRequest):

    log_text: str = Field(
        ...,
        min_length=1,
        max_length=100000,
        description="SSH authentication logs"
    )

    include_ai_report: bool = True


# ==============================
# SECURITY ANALYSIS RESPONSE
# ==============================

class AnalysisResponse(BaseModel):

    status: str

    analysis: dict[str, Any]

    ai_report: str | None = None


# ==============================
# HEALTH CHECK RESPONSE
# ==============================

class HealthResponse(BaseModel):

    status: str
    service: str
