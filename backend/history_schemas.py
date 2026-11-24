
from typing import Any, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
)


# =========================================
# SHARED TYPES
# =========================================

InvestigationType = Literal[
    "phishing",
    "logs",
    "anomaly",
]

MessageRole = Literal[
    "user",
    "assistant",
]


# =========================================
# BASE REQUEST MODEL
# =========================================

class HistoryRequest(BaseModel):

    model_config = ConfigDict(

        str_strip_whitespace=True,

        extra="forbid",

    )


# =========================================
# CONVERSATION REQUEST SCHEMAS
# =========================================

class CreateConversationRequest(
    HistoryRequest
):

    title: str = Field(

        default="New conversation",

        min_length=1,

        max_length=120,

    )


class RenameConversationRequest(
    HistoryRequest
):

    title: str = Field(

        min_length=1,

        max_length=120,

    )


# =========================================
# CONVERSATION RESPONSE SCHEMAS
# =========================================

class ConversationResponse(BaseModel):

    id: str

    title: str

    created_at: str

    updated_at: str


class ConversationSummary(
    ConversationResponse
):

    message_count: int = Field(
        ge=0
    )

    last_message: str | None = None


class MessageResponse(BaseModel):

    id: int

    conversation_id: str

    role: MessageRole

    content: str

    created_at: str


class ConversationDetail(
    ConversationResponse
):

    messages: list[MessageResponse]


class ConversationListResponse(
    BaseModel
):

    status: str = "success"

    count: int = Field(
        ge=0
    )

    conversations: list[
        ConversationSummary
    ]


# =========================================
# INVESTIGATION REQUEST SCHEMAS
# =========================================

class RenameInvestigationRequest(
    HistoryRequest
):

    title: str = Field(

        min_length=1,

        max_length=120,

    )


# =========================================
# INVESTIGATION RESPONSE SCHEMAS
# =========================================

class InvestigationSummary(BaseModel):

    id: str

    investigation_type: InvestigationType

    title: str

    status: str

    risk_level: str | None = None

    has_ai_report: bool

    created_at: str


class InvestigationDetail(BaseModel):

    id: str

    investigation_type: InvestigationType

    title: str

    status: str

    risk_level: str | None = None

    analysis: dict[str, Any]

    ai_report: str | None = None

    created_at: str


class InvestigationListResponse(
    BaseModel
):

    status: str = "success"

    count: int = Field(
        ge=0
    )

    investigations: list[
        InvestigationSummary
    ]


# =========================================
# HISTORY STATISTICS
# =========================================

class ConversationStatistics(
    BaseModel
):

    total_conversations: int = Field(
        ge=0
    )

    total_messages: int = Field(
        ge=0
    )

    user_messages: int = Field(
        ge=0
    )

    assistant_messages: int = Field(
        ge=0
    )


class InvestigationStatistics(
    BaseModel
):

    total_investigations: int = Field(
        ge=0
    )

    phishing_investigations: int = Field(
        ge=0
    )

    log_investigations: int = Field(
        ge=0
    )

    anomaly_investigations: int = Field(
        ge=0
    )

    ai_reports: int = Field(
        ge=0
    )


class HistoryStatisticsResponse(
    BaseModel
):

    status: str = "success"

    conversations: ConversationStatistics

    investigations: InvestigationStatistics


# =========================================
# DATABASE INFORMATION
# =========================================

class DatabaseInformationResponse(
    BaseModel
):

    status: str = "success"

    sqlite_version: str

    schema_version: int

    tables: list[str]

    integrity: str

    size_bytes: int = Field(
        ge=0
    )


# =========================================
# GENERIC OPERATION RESPONSE
# =========================================

class OperationResponse(BaseModel):

    status: str = "success"

    message: str

    id: str
