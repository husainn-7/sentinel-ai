
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)

from database.db import (
    DATABASE_PATH,
    get_database_info,
)

from database.conversations import (
    create_conversation,
    get_conversation,
    get_messages,
    list_conversations,
    search_conversations,
    rename_conversation,
    delete_conversation,
    get_conversation_statistics,
)

from database.investigations import (
    get_investigation,
    list_investigations,
    search_investigations,
    rename_investigation,
    delete_investigation,
    get_investigation_statistics,
)

from backend.history_schemas import (
    InvestigationType,
    CreateConversationRequest,
    RenameConversationRequest,
    ConversationResponse,
    ConversationDetail,
    ConversationListResponse,
    RenameInvestigationRequest,
    InvestigationDetail,
    InvestigationListResponse,
    HistoryStatisticsResponse,
    DatabaseInformationResponse,
    OperationResponse,
)


# =========================================
# ROUTER CONFIGURATION
# =========================================

router = APIRouter(

    prefix="/history",

    tags=["Persistent History"],

)


# =========================================
# DATABASE DEPENDENCY
# =========================================

def get_database_path():

    return DATABASE_PATH


DatabaseDependency = Annotated[
    object,
    Depends(get_database_path)
]


# =========================================
# HISTORY STATISTICS
# =========================================

@router.get(
    "/stats",
    response_model=HistoryStatisticsResponse
)
def history_statistics(
    db_path: DatabaseDependency
):

    conversation_statistics = (
        get_conversation_statistics(
            db_path=db_path
        )
    )

    investigation_statistics = (
        get_investigation_statistics(
            db_path=db_path
        )
    )

    return {

        "status": "success",

        "conversations":
            conversation_statistics,

        "investigations":
            investigation_statistics,

    }


# =========================================
# DATABASE INFORMATION
# =========================================

@router.get(
    "/database",
    response_model=DatabaseInformationResponse
)
def database_information(
    db_path: DatabaseDependency
):

    information = get_database_info(
        db_path=db_path
    )

    return {

        "status": "success",

        "sqlite_version":
            information["sqlite_version"],

        "schema_version":
            information["schema_version"],

        "tables":
            information["tables"],

        "integrity":
            information["integrity"],

        "size_bytes":
            information["size_bytes"],

    }


# =========================================
# CREATE CONVERSATION
# =========================================

@router.post(

    "/conversations",

    response_model=ConversationResponse,

    status_code=status.HTTP_201_CREATED,

)
def create_saved_conversation(

    request: CreateConversationRequest,

    db_path: DatabaseDependency,

):

    conversation = create_conversation(

        title=request.title,

        db_path=db_path,

    )

    return conversation


# =========================================
# LIST AND SEARCH CONVERSATIONS
# =========================================

@router.get(

    "/conversations",

    response_model=ConversationListResponse,

)
def retrieve_conversations(

    db_path: DatabaseDependency,

    q: Annotated[
        str | None,
        Query(max_length=500)
    ] = None,

    limit: Annotated[
        int,
        Query(ge=1, le=100)
    ] = 50,

    offset: Annotated[
        int,
        Query(ge=0)
    ] = 0,

):

    if q and q.strip():

        if offset != 0:

            raise HTTPException(

                status_code=400,

                detail=(
                    "Search does not currently "
                    "support pagination offsets."
                ),

            )

        conversations = search_conversations(

            query=q,

            limit=limit,

            db_path=db_path,

        )

    else:

        conversations = list_conversations(

            limit=limit,

            offset=offset,

            db_path=db_path,

        )

    return {

        "status": "success",

        "count": len(conversations),

        "conversations": conversations,

    }


# =========================================
# RETRIEVE FULL CONVERSATION
# =========================================

@router.get(

    "/conversations/{conversation_id}",

    response_model=ConversationDetail,

)
def retrieve_conversation(

    conversation_id: str,

    db_path: DatabaseDependency,

):

    conversation = get_conversation(

        conversation_id,

        db_path=db_path,

    )

    if conversation is None:

        raise HTTPException(

            status_code=404,

            detail="Conversation not found.",

        )

    messages = get_messages(

        conversation_id,

        db_path=db_path,

    )

    return {

        **conversation,

        "messages": messages,

    }


# =========================================
# RENAME CONVERSATION
# =========================================

@router.patch(

    "/conversations/{conversation_id}",

    response_model=OperationResponse,

)
def update_conversation_title(

    conversation_id: str,

    request: RenameConversationRequest,

    db_path: DatabaseDependency,

):

    updated = rename_conversation(

        conversation_id,

        request.title,

        db_path=db_path,

    )

    if not updated:

        raise HTTPException(

            status_code=404,

            detail="Conversation not found.",

        )

    return {

        "status": "success",

        "message":
            "Conversation renamed successfully.",

        "id": conversation_id,

    }


# =========================================
# DELETE CONVERSATION
# =========================================

@router.delete(

    "/conversations/{conversation_id}",

    response_model=OperationResponse,

)
def remove_conversation(

    conversation_id: str,

    db_path: DatabaseDependency,

):

    deleted = delete_conversation(

        conversation_id,

        db_path=db_path,

    )

    if not deleted:

        raise HTTPException(

            status_code=404,

            detail="Conversation not found.",

        )

    return {

        "status": "success",

        "message":
            "Conversation deleted successfully.",

        "id": conversation_id,

    }


# =========================================
# LIST AND SEARCH INVESTIGATIONS
# =========================================

@router.get(

    "/investigations",

    response_model=InvestigationListResponse,

)
def retrieve_investigations(

    db_path: DatabaseDependency,

    investigation_type: InvestigationType | None = None,

    q: Annotated[
        str | None,
        Query(max_length=500)
    ] = None,

    limit: Annotated[
        int,
        Query(ge=1, le=100)
    ] = 50,

    offset: Annotated[
        int,
        Query(ge=0)
    ] = 0,

):

    if q and q.strip():

        if offset != 0:

            raise HTTPException(

                status_code=400,

                detail=(
                    "Search does not currently "
                    "support pagination offsets."
                ),

            )

        investigations = search_investigations(

            query=q,

            investigation_type=investigation_type,

            limit=limit,

            db_path=db_path,

        )

    else:

        investigations = list_investigations(

            investigation_type=investigation_type,

            limit=limit,

            offset=offset,

            db_path=db_path,

        )

    return {

        "status": "success",

        "count": len(investigations),

        "investigations": investigations,

    }


# =========================================
# RETRIEVE FULL INVESTIGATION
# =========================================

@router.get(

    "/investigations/{investigation_id}",

    response_model=InvestigationDetail,

)
def retrieve_investigation(

    investigation_id: str,

    db_path: DatabaseDependency,

):

    investigation = get_investigation(

        investigation_id,

        db_path=db_path,

    )

    if investigation is None:

        raise HTTPException(

            status_code=404,

            detail="Investigation not found.",

        )

    return investigation


# =========================================
# RENAME INVESTIGATION
# =========================================

@router.patch(

    "/investigations/{investigation_id}",

    response_model=OperationResponse,

)
def update_investigation_title(

    investigation_id: str,

    request: RenameInvestigationRequest,

    db_path: DatabaseDependency,

):

    updated = rename_investigation(

        investigation_id,

        request.title,

        db_path=db_path,

    )

    if not updated:

        raise HTTPException(

            status_code=404,

            detail="Investigation not found.",

        )

    return {

        "status": "success",

        "message":
            "Investigation renamed successfully.",

        "id": investigation_id,

    }


# =========================================
# DELETE INVESTIGATION
# =========================================

@router.delete(

    "/investigations/{investigation_id}",

    response_model=OperationResponse,

)
def remove_investigation(

    investigation_id: str,

    db_path: DatabaseDependency,

):

    deleted = delete_investigation(

        investigation_id,

        db_path=db_path,

    )

    if not deleted:

        raise HTTPException(

            status_code=404,

            detail="Investigation not found.",

        )

    return {

        "status": "success",

        "message":
            "Investigation deleted successfully.",

        "id": investigation_id,

    }
