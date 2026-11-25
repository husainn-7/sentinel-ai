
from uuid import uuid4

from database.db import get_connection


# =========================================
# CONFIGURATION
# =========================================

MAX_TITLE_LENGTH = 120

MAX_MESSAGE_LENGTH = 20000

VALID_ROLES = {"user", "assistant"}


# =========================================
# VALIDATION HELPERS
# =========================================

def normalize_title(title):

    if not isinstance(title, str):

        raise ValueError(
            "Conversation title must be a string."
        )

    title = " ".join(title.split())

    if not title:

        title = "New conversation"

    return title[:MAX_TITLE_LENGTH]


def normalize_message(content):

    if not isinstance(content, str):

        raise ValueError(
            "Message content must be a string."
        )

    content = content.strip()

    if not content:

        raise ValueError(
            "Message content cannot be empty."
        )

    if len(content) > MAX_MESSAGE_LENGTH:

        raise ValueError(
            "Message content exceeds the allowed limit."
        )

    return content


# =========================================
# CREATE CONVERSATION
# =========================================

def create_conversation(
    title="New conversation",
    db_path=None
):

    conversation_id = str(uuid4())

    title = normalize_title(title)

    with get_connection(db_path) as connection:

        connection.execute("""

            INSERT INTO conversations (
                id,
                title
            )

            VALUES (?, ?)

        """, (
            conversation_id,
            title
        ))

        row = connection.execute("""

            SELECT *

            FROM conversations

            WHERE id = ?

        """, (
            conversation_id,
        )).fetchone()

    return dict(row)


# =========================================
# RETRIEVE CONVERSATION
# =========================================

def get_conversation(
    conversation_id,
    db_path=None
):

    with get_connection(db_path) as connection:

        row = connection.execute("""

            SELECT *

            FROM conversations

            WHERE id = ?

        """, (
            conversation_id,
        )).fetchone()

    if row is None:

        return None

    return dict(row)


# =========================================
# SAVE INDIVIDUAL MESSAGE
# =========================================

def add_message(
    conversation_id,
    role,
    content,
    db_path=None
):

    if role not in VALID_ROLES:

        raise ValueError(
            "Invalid message role."
        )

    content = normalize_message(content)

    with get_connection(db_path) as connection:

        connection.execute(
            "BEGIN IMMEDIATE"
        )

        conversation = connection.execute("""

            SELECT id

            FROM conversations

            WHERE id = ?

        """, (
            conversation_id,
        )).fetchone()

        if conversation is None:

            raise ValueError(
                "Conversation does not exist."
            )

        cursor = connection.execute("""

            INSERT INTO messages (
                conversation_id,
                role,
                content
            )

            VALUES (?, ?, ?)

        """, (
            conversation_id,
            role,
            content
        ))

        message_id = cursor.lastrowid

        connection.execute("""

            UPDATE conversations

            SET updated_at = strftime(
                '%Y-%m-%dT%H:%M:%fZ',
                'now'
            )

            WHERE id = ?

        """, (
            conversation_id,
        ))

        row = connection.execute("""

            SELECT *

            FROM messages

            WHERE id = ?

        """, (
            message_id,
        )).fetchone()

    return dict(row)


# =========================================
# SAVE COMPLETE CONVERSATION TURN
# =========================================

def save_chat_turn(
    conversation_id,
    user_message,
    assistant_message,
    db_path=None
):

    user_message = normalize_message(
        user_message
    )

    assistant_message = normalize_message(
        assistant_message
    )

    with get_connection(db_path) as connection:

        connection.execute(
            "BEGIN IMMEDIATE"
        )

        conversation = connection.execute("""

            SELECT id, title

            FROM conversations

            WHERE id = ?

        """, (
            conversation_id,
        )).fetchone()

        if conversation is None:

            raise ValueError(
                "Conversation does not exist."
            )

        message_count = connection.execute("""

            SELECT COUNT(*)

            FROM messages

            WHERE conversation_id = ?

        """, (
            conversation_id,
        )).fetchone()[0]

        connection.executemany("""

            INSERT INTO messages (
                conversation_id,
                role,
                content
            )

            VALUES (?, ?, ?)

        """, [

            (
                conversation_id,
                "user",
                user_message
            ),

            (
                conversation_id,
                "assistant",
                assistant_message
            )

        ])

        title = conversation["title"]

        if (
            message_count == 0
            and title == "New conversation"
        ):

            title = normalize_title(
                user_message
            )

        connection.execute("""

            UPDATE conversations

            SET title = ?,

                updated_at = strftime(
                    '%Y-%m-%dT%H:%M:%fZ',
                    'now'
                )

            WHERE id = ?

        """, (
            title,
            conversation_id
        ))

    return {

        "conversation_id": conversation_id,

        "title": title,

        "messages_saved": 2,

    }


# =========================================
# RETRIEVE MESSAGE HISTORY
# =========================================

def get_messages(
    conversation_id,
    limit=None,
    db_path=None
):

    with get_connection(db_path) as connection:

        if limit is None:

            rows = connection.execute("""

                SELECT *

                FROM messages

                WHERE conversation_id = ?

                ORDER BY id ASC

            """, (
                conversation_id,
            )).fetchall()

        else:

            if (
                not isinstance(limit, int)
                or isinstance(limit, bool)
                or limit < 1
            ):

                raise ValueError(
                    "Message limit must be a positive integer."
                )

            rows = connection.execute("""

                SELECT *

                FROM (

                    SELECT *

                    FROM messages

                    WHERE conversation_id = ?

                    ORDER BY id DESC

                    LIMIT ?

                )

                ORDER BY id ASC

            """, (
                conversation_id,
                limit
            )).fetchall()

    return [
        dict(row)
        for row in rows
    ]


# =========================================
# RETRIEVE LIMITED CONTEXT FOR LLM
# =========================================

def get_recent_context(
    conversation_id,
    max_messages=6,
    max_characters=6000,
    db_path=None
):

    if (
        not isinstance(max_characters, int)
        or isinstance(max_characters, bool)
        or max_characters < 1
    ):

        raise ValueError(
            "Character limit must be a positive integer."
        )

    messages = get_messages(
        conversation_id,
        limit=max_messages,
        db_path=db_path
    )

    context = []

    total_characters = 0

    for message in reversed(messages):

        content = message["content"]

        if (
            total_characters + len(content)
            > max_characters
        ):

            break

        context.append({

            "role": message["role"],

            "content": content,

        })

        total_characters += len(content)

    context.reverse()

    return context


# =========================================
# LIST SAVED CONVERSATIONS
# =========================================

def list_conversations(
    limit=50,
    offset=0,
    db_path=None
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

    with get_connection(db_path) as connection:

        rows = connection.execute("""

            SELECT

                c.id,

                c.title,

                c.created_at,

                c.updated_at,

                (
                    SELECT COUNT(*)

                    FROM messages AS m

                    WHERE m.conversation_id = c.id

                ) AS message_count,

                (
                    SELECT content

                    FROM messages AS m

                    WHERE m.conversation_id = c.id

                    ORDER BY m.id DESC

                    LIMIT 1

                ) AS last_message

            FROM conversations AS c

            ORDER BY
                c.updated_at DESC,
                c.id DESC

            LIMIT ?

            OFFSET ?

        """, (
            limit,
            offset
        )).fetchall()

    conversations = []

    for row in rows:

        item = dict(row)

        last_message = item.get(
            "last_message"
        )

        if last_message:

            item["last_message"] = (
                last_message[:180]
            )

        conversations.append(item)

    return conversations


# =========================================
# SEARCH CONVERSATIONS
# =========================================

def search_conversations(
    query,
    limit=50,
    db_path=None
):

    if not isinstance(query, str):

        raise ValueError(
            "Search query must be a string."
        )

    query = query.strip()

    if not query:

        return list_conversations(
            limit=limit,
            db_path=db_path
        )

    if (
        not isinstance(limit, int)
        or isinstance(limit, bool)
        or not 1 <= limit <= 100
    ):

        raise ValueError(
            "Limit must be between 1 and 100."
        )

    if len(query) > 500:

        raise ValueError(
            "Search query is too long."
        )

    # Escape LIKE wildcard characters.

    escaped_query = (
        query
        .replace("\\", "\\\\")
        .replace("%", "\\%")
        .replace("_", "\\_")
    )

    pattern = f"%{escaped_query}%"

    with get_connection(db_path) as connection:

        rows = connection.execute("""

            SELECT

                c.id,

                c.title,

                c.created_at,

                c.updated_at,

                (
                    SELECT COUNT(*)

                    FROM messages AS m

                    WHERE m.conversation_id = c.id

                ) AS message_count

            FROM conversations AS c

            WHERE c.title LIKE ? ESCAPE '\\'

            OR EXISTS (

                SELECT 1

                FROM messages AS m

                WHERE m.conversation_id = c.id

                AND m.content LIKE ? ESCAPE '\\'

            )

            ORDER BY
                c.updated_at DESC,
                c.id DESC

            LIMIT ?

        """, (
            pattern,
            pattern,
            limit
        )).fetchall()

    return [
        dict(row)
        for row in rows
    ]


# =========================================
# RENAME CONVERSATION
# =========================================

def rename_conversation(
    conversation_id,
    title,
    db_path=None
):

    title = normalize_title(title)

    with get_connection(db_path) as connection:

        cursor = connection.execute("""

            UPDATE conversations

            SET title = ?,

                updated_at = strftime(
                    '%Y-%m-%dT%H:%M:%fZ',
                    'now'
                )

            WHERE id = ?

        """, (
            title,
            conversation_id
        ))

        updated = cursor.rowcount > 0

    return updated


# =========================================
# DELETE CONVERSATION
# =========================================

def delete_conversation(
    conversation_id,
    db_path=None
):

    with get_connection(db_path) as connection:

        cursor = connection.execute("""

            DELETE FROM conversations

            WHERE id = ?

        """, (
            conversation_id,
        ))

        deleted = cursor.rowcount > 0

    return deleted


# =========================================
# CONVERSATION STATISTICS
# =========================================

def get_conversation_statistics(
    db_path=None
):

    with get_connection(db_path) as connection:

        total_conversations = connection.execute("""

            SELECT COUNT(*)

            FROM conversations

        """).fetchone()[0]

        total_messages = connection.execute("""

            SELECT COUNT(*)

            FROM messages

        """).fetchone()[0]

        user_messages = connection.execute("""

            SELECT COUNT(*)

            FROM messages

            WHERE role = 'user'

        """).fetchone()[0]

        assistant_messages = connection.execute("""

            SELECT COUNT(*)

            FROM messages

            WHERE role = 'assistant'

        """).fetchone()[0]

    return {

        "total_conversations":
            total_conversations,

        "total_messages":
            total_messages,

        "user_messages":
            user_messages,

        "assistant_messages":
            assistant_messages,

    }

# =========================================
# ATOMIC CONVERSATION CREATION
# =========================================

def create_conversation_with_turn(
    user_message,
    assistant_message,
    title="New conversation",
    db_path=None,
):

    # Validate all inputs before opening a transaction.

    user_message = normalize_message(
        user_message
    )

    assistant_message = normalize_message(
        assistant_message
    )

    title = normalize_title(title)

    if title == "New conversation":

        title = normalize_title(
            user_message
        )

    conversation_id = str(uuid4())

    # Create the conversation and both messages
    # inside a single atomic transaction.

    with get_connection(db_path) as connection:

        connection.execute(
            "BEGIN IMMEDIATE"
        )

        connection.execute("""
            INSERT INTO conversations (
                id,
                title
            )
            VALUES (?, ?)
        """, (
            conversation_id,
            title,
        ))

        connection.executemany("""
            INSERT INTO messages (
                conversation_id,
                role,
                content
            )
            VALUES (?, ?, ?)
        """, [
            (
                conversation_id,
                "user",
                user_message,
            ),
            (
                conversation_id,
                "assistant",
                assistant_message,
            ),
        ])

        connection.execute("""
            UPDATE conversations

            SET updated_at = strftime(
                '%Y-%m-%dT%H:%M:%fZ',
                'now'
            )

            WHERE id = ?
        """, (
            conversation_id,
        ))

    return {
        "conversation_id": conversation_id,
        "title": title,
        "messages_saved": 2,
    }
