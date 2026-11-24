
import sqlite3

from pathlib import Path
from contextlib import contextmanager


# =========================================
# DATABASE CONFIGURATION
# =========================================

BASE_DIR = Path(__file__).resolve().parent.parent

DATABASE_PATH = BASE_DIR / "database" / "sentinel.db"

SCHEMA_VERSION = 1


# =========================================
# DATABASE CONNECTION
# =========================================

@contextmanager
def get_connection(db_path=None):

    path = Path(
        db_path if db_path is not None
        else DATABASE_PATH
    )

    path.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    connection = sqlite3.connect(
        str(path),
        timeout=10.0
    )

    try:

        connection.row_factory = sqlite3.Row

        connection.execute(
            "PRAGMA foreign_keys = ON"
        )

        connection.execute(
            "PRAGMA busy_timeout = 10000"
        )

        yield connection

        connection.commit()

    except Exception:

        connection.rollback()

        raise

    finally:

        connection.close()


# =========================================
# DATABASE INITIALIZATION
# =========================================

def initialize_database(db_path=None):

    with get_connection(db_path) as connection:

        current_version = connection.execute(
            "PRAGMA user_version"
        ).fetchone()[0]

        if current_version > SCHEMA_VERSION:

            raise RuntimeError(
                "Database schema is newer than "
                "this Sentinel AI version supports."
            )

        connection.executescript("""

            BEGIN IMMEDIATE;

            CREATE TABLE IF NOT EXISTS conversations (

                id TEXT PRIMARY KEY,

                title TEXT NOT NULL,

                created_at TEXT NOT NULL DEFAULT (
                    strftime(
                        '%Y-%m-%dT%H:%M:%fZ',
                        'now'
                    )
                ),

                updated_at TEXT NOT NULL DEFAULT (
                    strftime(
                        '%Y-%m-%dT%H:%M:%fZ',
                        'now'
                    )
                )

            );


            CREATE TABLE IF NOT EXISTS messages (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                conversation_id TEXT NOT NULL,

                role TEXT NOT NULL CHECK (
                    role IN ('user', 'assistant')
                ),

                content TEXT NOT NULL CHECK (
                    length(trim(content)) > 0
                ),

                created_at TEXT NOT NULL DEFAULT (
                    strftime(
                        '%Y-%m-%dT%H:%M:%fZ',
                        'now'
                    )
                ),

                FOREIGN KEY (conversation_id)
                    REFERENCES conversations(id)
                    ON DELETE CASCADE

            );


            CREATE TABLE IF NOT EXISTS investigations (

                id TEXT PRIMARY KEY,

                investigation_type TEXT NOT NULL CHECK (
                    investigation_type IN (
                        'phishing',
                        'logs',
                        'anomaly'
                    )
                ),

                title TEXT NOT NULL,

                status TEXT NOT NULL,

                risk_level TEXT,

                analysis_json TEXT NOT NULL CHECK (
                    json_valid(analysis_json)
                ),

                ai_report TEXT,

                created_at TEXT NOT NULL DEFAULT (
                    strftime(
                        '%Y-%m-%dT%H:%M:%fZ',
                        'now'
                    )
                )

            );


            CREATE INDEX IF NOT EXISTS
                idx_messages_conversation

            ON messages (
                conversation_id,
                id
            );


            CREATE INDEX IF NOT EXISTS
                idx_conversations_updated

            ON conversations (
                updated_at DESC
            );


            CREATE INDEX IF NOT EXISTS
                idx_investigations_type

            ON investigations (
                investigation_type
            );


            CREATE INDEX IF NOT EXISTS
                idx_investigations_created

            ON investigations (
                created_at DESC
            );


            PRAGMA user_version = 1;

            COMMIT;

        """)


# =========================================
# DATABASE INFORMATION
# =========================================

def get_database_info(db_path=None):

    path = Path(
        db_path if db_path is not None
        else DATABASE_PATH
    )

    with get_connection(path) as connection:

        rows = connection.execute("""

            SELECT name

            FROM sqlite_master

            WHERE type = 'table'

            AND name NOT LIKE 'sqlite_%'

            ORDER BY name

        """).fetchall()

        version = connection.execute(
            "PRAGMA user_version"
        ).fetchone()[0]

        integrity = connection.execute(
            "PRAGMA quick_check"
        ).fetchone()[0]

    return {

        "database_path": str(path),

        "sqlite_version": sqlite3.sqlite_version,

        "schema_version": version,

        "tables": [
            row["name"]
            for row in rows
        ],

        "integrity": integrity,

        "size_bytes": (
            path.stat().st_size
            if path.exists()
            else 0
        ),

    }


# =========================================
# MANUAL INITIALIZATION
# =========================================

if __name__ == "__main__":

    initialize_database()

    information = get_database_info()

    print("\nSENTINEL AI DATABASE")

    print("=" * 45)

    print(
        "Database:",
        information["database_path"]
    )

    print(
        "SQLite version:",
        information["sqlite_version"]
    )

    print(
        "Schema version:",
        information["schema_version"]
    )

    print(
        "Integrity:",
        information["integrity"]
    )

    print(
        "Database size:",
        information["size_bytes"],
        "bytes"
    )

    print("\nInitialized tables:")

    for table in information["tables"]:

        print(f"  - {table}")

    print("\nDatabase initialized successfully.")
