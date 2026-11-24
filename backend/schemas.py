
from typing import Any, Literal

from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
)


# =========================================
# BASE REQUEST MODEL
# =========================================

class BaseRequest(BaseModel):

    model_config = ConfigDict(

        str_strip_whitespace=True,

        extra="forbid",

    )


# =========================================
# CONVERSATION MESSAGE
# =========================================

class ConversationMessage(BaseRequest):

    role: Literal[
        "user",
        "assistant",
    ]

    content: str = Field(

        min_length=1,

        max_length=8000,

    )


# =========================================
# CHAT REQUEST
# =========================================

class ChatRequest(BaseRequest):

    message: str = Field(

        min_length=1,

        max_length=4000,

    )

    history: list[ConversationMessage] = Field(

        default_factory=list,

        max_length=6,

    )

    conversation_id: UUID | None = None

    save_history: bool = False


# =========================================
# CHAT RESPONSE
# =========================================

class ChatResponse(BaseModel):

    response: str

    model: str

    conversation_id: str | None = None

    history_saved: bool = False

    storage_warning: str | None = None


# =========================================
# SHARED INVESTIGATION REQUEST
# =========================================

class InvestigationRequest(BaseRequest):

    include_ai_report: bool = True

    save_history: bool = False

    title: str | None = Field(

        default=None,

        min_length=1,

        max_length=120,

    )


# =========================================
# PHISHING ANALYSIS REQUEST
# =========================================

class PhishingRequest(InvestigationRequest):

    email_text: str = Field(

        min_length=1,

        max_length=20000,

    )


# =========================================
# SECURITY LOG ANALYSIS REQUEST
# =========================================

class LogRequest(InvestigationRequest):

    log_text: str = Field(

        min_length=1,

        max_length=100000,

    )


# =========================================
# ML ANOMALY ANALYSIS REQUEST
# =========================================

class AnomalyRequest(InvestigationRequest):

    log_text: str = Field(

        min_length=1,

        max_length=100000,

    )


# =========================================
# ANALYSIS RESPONSE
# =========================================

class AnalysisResponse(BaseModel):

    status: str

    analysis: dict[str, Any]

    ai_report: str | None = None

    investigation_id: str | None = None

    history_saved: bool = False

    storage_warning: str | None = None


# =========================================
# HEALTH RESPONSE
# =========================================

class HealthResponse(BaseModel):

    status: str

    service: str
