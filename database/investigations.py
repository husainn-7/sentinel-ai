
import json

from uuid import uuid4

from database.db import get_connection


# =========================================
# CONFIGURATION
# =========================================

VALID_TYPES = {
    "phishing",
    "logs",
    "anomaly",
}

DEFAULT_TITLES = {

    "phishing": "Phishing investigation",

    "logs": "Security log investigation",

    "anomaly": "ML anomaly investigation",

}

MAX_TITLE_LENGTH = 120

MAX_REPORT_LENGTH = 100000

MAX_ANALYSIS_LENGTH = 5000000


# =========================================
# VALIDATION HELPERS
# =========================================

def validate_investigation_type(
    investigation_type
):

    if investigation_type not in VALID_TYPES:

        raise ValueError(
            "Invalid investigation type."
        )

    return investigation_type


def normalize_title(
    title,
    investigation_type
):

    if title is None:

        return DEFAULT_TITLES[
            investigation_type
        ]

    if not isinstance(title, str):

        raise ValueError(
            "Investigation title must be a string."
        )

    title = " ".join(title.split())

    if not title:

        title = DEFAULT_TITLES[
            investigation_type
        ]

    return title[:MAX_TITLE_LENGTH]


def validate_pagination(
    limit,
    offset=0
):

    if (
        not isinstance(limit, int)
        or isinstance(limit, bool)
        or not 1 <= limit <= 100
    ):

        raise ValueError(
            "Limit must be between 1 and 100."
        )

    if (
        not isinstance(offset, int)
        or isinstance(offset, bool)
        or offset < 0
    ):

        raise ValueError(
            "Offset cannot be negative."
        )


# =========================================
# ANALYSIS SERIALIZATION
# =========================================

def serialize_analysis(analysis):

    if not isinstance(analysis, dict):

        raise ValueError(
            "Analysis must be a dictionary."
        )

    try:

        serialized = json.dumps(
            analysis,
            ensure_ascii=False,
            allow_nan=False
        )

    except (TypeError, ValueError) as exception:

        raise ValueError(
            "Analysis contains invalid JSON data."
        ) from exception

    if len(serialized) > MAX_ANALYSIS_LENGTH:

        raise ValueError(
            "Analysis exceeds the storage limit."
        )

    return serialized


def deserialize_investigation(row):

    if row is None:

        return None

    investigation = dict(row)

    if "analysis_json" in investigation:

        investigation["analysis"] = json.loads(

            investigation.pop(
                "analysis_json"
            )

        )

    return investigation


# =========================================
# RISK CLASSIFICATION
# =========================================

def extract_risk_level(
    investigation_type,
    analysis
):

    if investigation_type == "phishing":

        risk = analysis.get(
            "risk_level"
        )

        if isinstance(risk, str):

            return risk

        return None


    if investigation_type == "logs":

        risk = analysis.get(
            "overall_risk"
        )

        if isinstance(risk, str):

            return risk

        return None


    if investigation_type == "anomaly":

        # Anomaly results do not provide a
        # calibrated overall risk level.
        #
        # Do not invent a risk classification
        # from model decision scores.

        return None

    return None


# =========================================
# SAVE INVESTIGATION
# =========================================

def save_investigation(
    investigation_type,
    analysis,
    status="success",
    ai_report=None,
    title=None,
    db_path=None
):

    validate_investigation_type(
        investigation_type
    )

    title = normalize_title(
        title,
        investigation_type
    )

    if (
        not isinstance(status, str)
        or not status.strip()
    ):

        raise ValueError(
            "Investigation status cannot be empty."
        )

    status = status.strip()

    if len(status) > 100:

        raise ValueError(
            "Investigation status is too long."
        )

    if ai_report is not None:

        if not isinstance(ai_report, str):

            raise ValueError(
                "AI report must be a string."
            )

        ai_report = ai_report.strip()

        if len(ai_report) > MAX_REPORT_LENGTH:

            raise ValueError(
                "AI report exceeds the storage limit."
            )

        if not ai_report:

            ai_report = None

    analysis_json = serialize_analysis(
        analysis
    )

    risk_level = extract_risk_level(
        investigation_type,
        analysis
    )

    investigation_id = str(uuid4())

    with get_connection(db_path) as connection:

        connection.execute("""

            INSERT INTO investigations (

                id,

                investigation_type,

                title,

                status,

                risk_level,

                analysis_json,

                ai_report

            )

            VALUES (?, ?, ?, ?, ?, ?, ?)

        """, (

            investigation_id,

            investigation_type,

            title,

            status,

            risk_level,

            analysis_json,

            ai_report

        ))

        row = connection.execute("""

            SELECT *

            FROM investigations

            WHERE id = ?

        """, (
            investigation_id,
        )).fetchone()

    return deserialize_investigation(row)


# =========================================
# RETRIEVE INDIVIDUAL INVESTIGATION
# =========================================

def get_investigation(
    investigation_id,
    db_path=None
):

    with get_connection(db_path) as connection:

        row = connection.execute("""

            SELECT *

            FROM investigations

            WHERE id = ?

        """, (
            investigation_id,
        )).fetchone()

    return deserialize_investigation(row)


# =========================================
# LIST SAVED INVESTIGATIONS
# =========================================

def list_investigations(
    investigation_type=None,
    limit=50,
    offset=0,
    db_path=None
):

    validate_pagination(
        limit,
        offset
    )

    if investigation_type is not None:

        validate_investigation_type(
            investigation_type
        )

    query = """

        SELECT

            id,

            investigation_type,

            title,

            status,

            risk_level,

            CASE

                WHEN ai_report IS NOT NULL

                THEN 1

                ELSE 0

            END AS has_ai_report,

            created_at

        FROM investigations

    """

    parameters = []

    if investigation_type is not None:

        query += """

            WHERE investigation_type = ?

        """

        parameters.append(
            investigation_type
        )

    query += """

        ORDER BY

            created_at DESC,

            id DESC

        LIMIT ?

        OFFSET ?

    """

    parameters.extend([

        limit,

        offset,

    ])

    with get_connection(db_path) as connection:

        rows = connection.execute(

            query,

            parameters

        ).fetchall()

    investigations = []

    for row in rows:

        item = dict(row)

        item["has_ai_report"] = bool(

            item["has_ai_report"]

        )

        investigations.append(item)

    return investigations


# =========================================
# SEARCH INVESTIGATIONS
# =========================================

def search_investigations(
    query,
    investigation_type=None,
    limit=50,
    db_path=None
):

    validate_pagination(limit)

    if not isinstance(query, str):

        raise ValueError(
            "Search query must be a string."
        )

    query = query.strip()

    if len(query) > 500:

        raise ValueError(
            "Search query is too long."
        )

    if investigation_type is not None:

        validate_investigation_type(
            investigation_type
        )

    if not query:

        return list_investigations(

            investigation_type=investigation_type,

            limit=limit,

            db_path=db_path

        )

    # Escape SQL LIKE wildcard characters.

    escaped_query = (

        query
        .replace("\\", "\\\\")
        .replace("%", "\\%")
        .replace("_", "\\_")

    )

    pattern = f"%{escaped_query}%"

    sql = """

        SELECT

            id,

            investigation_type,

            title,

            status,

            risk_level,

            CASE

                WHEN ai_report IS NOT NULL

                THEN 1

                ELSE 0

            END AS has_ai_report,

            created_at

        FROM investigations

        WHERE (

            title LIKE ? ESCAPE '\\'

            OR risk_level LIKE ? ESCAPE '\\'

            OR analysis_json LIKE ? ESCAPE '\\'

            OR ai_report LIKE ? ESCAPE '\\'

        )

    """

    parameters = [

        pattern,

        pattern,

        pattern,

        pattern,

    ]

    if investigation_type is not None:

        sql += """

            AND investigation_type = ?

        """

        parameters.append(
            investigation_type
        )

    sql += """

        ORDER BY

            created_at DESC,

            id DESC

        LIMIT ?

    """

    parameters.append(limit)

    with get_connection(db_path) as connection:

        rows = connection.execute(

            sql,

            parameters

        ).fetchall()

    investigations = []

    for row in rows:

        item = dict(row)

        item["has_ai_report"] = bool(

            item["has_ai_report"]

        )

        investigations.append(item)

    return investigations


# =========================================
# RENAME INVESTIGATION
# =========================================

def rename_investigation(
    investigation_id,
    title,
    db_path=None
):

    with get_connection(db_path) as connection:

        connection.execute(
            "BEGIN IMMEDIATE"
        )

        investigation = connection.execute("""

            SELECT investigation_type

            FROM investigations

            WHERE id = ?

        """, (
            investigation_id,
        )).fetchone()

        if investigation is None:

            return False

        title = normalize_title(

            title,

            investigation["investigation_type"]

        )

        cursor = connection.execute("""

            UPDATE investigations

            SET title = ?

            WHERE id = ?

        """, (

            title,

            investigation_id

        ))

        updated = cursor.rowcount > 0

    return updated


# =========================================
# DELETE INDIVIDUAL INVESTIGATION
# =========================================

def delete_investigation(
    investigation_id,
    db_path=None
):

    with get_connection(db_path) as connection:

        cursor = connection.execute("""

            DELETE FROM investigations

            WHERE id = ?

        """, (
            investigation_id,
        ))

        deleted = cursor.rowcount > 0

    return deleted


# =========================================
# INVESTIGATION STATISTICS
# =========================================

def get_investigation_statistics(
    db_path=None
):

    with get_connection(db_path) as connection:

        rows = connection.execute("""

            SELECT

                investigation_type,

                COUNT(*) AS total

            FROM investigations

            GROUP BY investigation_type

        """).fetchall()

        total_reports = connection.execute("""

            SELECT COUNT(*)

            FROM investigations

            WHERE ai_report IS NOT NULL

        """).fetchone()[0]

    counts = {

        "phishing": 0,

        "logs": 0,

        "anomaly": 0,

    }

    for row in rows:

        counts[
            row["investigation_type"]
        ] = row["total"]

    return {

        "total_investigations":
            sum(counts.values()),

        "phishing_investigations":
            counts["phishing"],

        "log_investigations":
            counts["logs"],

        "anomaly_investigations":
            counts["anomaly"],

        "ai_reports":
            total_reports,

    }
