
import logging

from typing import Any

from backend.schemas import InvestigationRequest

from database.investigations import (
    save_investigation,
)


# =========================================
# CONFIGURATION
# =========================================

logger = logging.getLogger(__name__)


SAVEABLE_STATUSES = {

    "success",

    "analysis_completed_ai_unavailable",

}


# =========================================
# STORAGE METADATA
# =========================================

def build_investigation_metadata(
    investigation_id=None,
    history_saved=False,
    storage_warning=None
):

    return {

        "investigation_id": investigation_id,

        "history_saved": history_saved,

        "storage_warning": storage_warning,

    }


# =========================================
# COMPLETE INVESTIGATION
# =========================================

def complete_investigation(
    investigation_type: str,
    request: InvestigationRequest,
    analysis: dict[str, Any],
    analysis_status: str,
    ai_report: str | None = None,
    db_path=None
):

    # Temporary investigations must never
    # be written to persistent storage.

    if not request.save_history:

        return build_investigation_metadata()


    # Do not save unsuccessful investigations
    # or analyses without valid observations.

    if analysis_status not in SAVEABLE_STATUSES:

        return build_investigation_metadata(

            history_saved=False,

            storage_warning=(
                "No valid investigation results "
                "were available to save."
            ),

        )


    try:

        # Store structured analysis results
        # rather than the original raw input.

        investigation = save_investigation(

            investigation_type=investigation_type,

            analysis=analysis,

            status=analysis_status,

            ai_report=ai_report,

            title=request.title,

            db_path=db_path,

        )

        return build_investigation_metadata(

            investigation_id=investigation["id"],

            history_saved=True,

        )


    except Exception as exception:

        # Never log raw emails, security logs
        # or sensitive investigation findings.

        logger.warning(

            "Investigation storage failed: %s",

            type(exception).__name__,

        )

        return build_investigation_metadata(

            history_saved=False,

            storage_warning=(

                "The investigation completed, "

                "but its results could not "

                "be saved to history."

            ),

        )


# =========================================
# BUILD FINAL INVESTIGATION RESPONSE
# =========================================

def build_investigation_response(
    investigation_type: str,
    request: InvestigationRequest,
    analysis: dict[str, Any],
    analysis_status: str = "success",
    ai_report: str | None = None,
    db_path=None
):

    result = {

        "status": analysis_status,

        "analysis": analysis,

        "ai_report": ai_report,

    }


    # Preserve the original response format
    # for temporary investigations.

    if not request.save_history:

        return result


    storage_metadata = complete_investigation(

        investigation_type=investigation_type,

        request=request,

        analysis=analysis,

        analysis_status=analysis_status,

        ai_report=ai_report,

        db_path=db_path,

    )

    result.update(
        storage_metadata
    )

    return result
