
"""SQLite persistence for human-in-the-loop banking reviews."""

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class InterruptStore:
    """Persist pending reviews and human decisions."""

    def __init__(self, db_path: Path):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self):
        conn = sqlite3.connect(self.db_path, timeout=10)
        conn.row_factory = sqlite3.Row
        return conn

    
    
    def _initialize(self):
        with self._connect() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS human_reviews (
                    id TEXT PRIMARY KEY,
                    query TEXT NOT NULL,
                    context_json TEXT NOT NULL,
                    status TEXT NOT NULL
                        CHECK (status IN (
                            'pending', 'approved', 'rejected'
                        )),
                    created_at TEXT NOT NULL,
                    decided_at TEXT,
                    reviewer_id TEXT,
                    decision_reason TEXT
                )
            """)

            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_human_reviews_status
                ON human_reviews(status, created_at)
            """)

            # Check whether the EDD column already exists.
            columns = {
                row["name"]
                for row in conn.execute(
                    "PRAGMA table_info(human_reviews)"
                ).fetchall()
            }

            # Add the column only if it is missing.
            if "edd_status" not in columns:
                conn.execute("""
                    ALTER TABLE human_reviews
                    ADD COLUMN edd_status TEXT NOT NULL
                    DEFAULT 'not_started'
                    CHECK (
                        edd_status IN (
                            'not_started',
                            'in_progress',
                            'completed'
                        )
                    )
                """)


            # Refresh columns after the EDD migration.
            columns = {
                row["name"]
                for row in conn.execute(
                    "PRAGMA table_info(human_reviews)"
                ).fetchall()
            }

            # Add senior management approval fields if missing.
            senior_approval_columns = {
                "senior_approval_status": """
                    ALTER TABLE human_reviews
                    ADD COLUMN senior_approval_status TEXT NOT NULL
                    DEFAULT 'not_started'
                    CHECK (
                        senior_approval_status IN (
                            'not_started', 'approved', 'rejected'
                        )
                    )
                """,
                "senior_reviewer_id": """
                    ALTER TABLE human_reviews
                    ADD COLUMN senior_reviewer_id TEXT
                """,
                "senior_approval_reason": """
                    ALTER TABLE human_reviews
                    ADD COLUMN senior_approval_reason TEXT
                """,
                "senior_decided_at": """
                    ALTER TABLE human_reviews
                    ADD COLUMN senior_decided_at TEXT
                """,
            }

            for column_name, migration_sql in senior_approval_columns.items():
                if column_name not in columns:
                    conn.execute(migration_sql)

    def create_review(self, query: str, context: dict) -> dict:
        review_id = str(uuid.uuid4())
        created_at = utc_now()

        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO human_reviews
                    (id, query, context_json, status, created_at)
                VALUES (?, ?, ?, 'pending', ?)
                """,
                (review_id, query, json.dumps(context), created_at),
            )

        return self.get_review(review_id)

    def get_review(self, review_id: str) -> Optional[dict]:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM human_reviews WHERE id = ?",
                (review_id,),
            ).fetchone()

        return self._serialize(row) if row else None

    def list_pending(self) -> list[dict]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM human_reviews
                WHERE status = 'pending'
                ORDER BY created_at ASC
                """
            ).fetchall()

        return [self._serialize(row) for row in rows]

    def list_all(self) -> list[dict]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM human_reviews ORDER BY created_at DESC"
            ).fetchall()

        return [self._serialize(row) for row in rows]

    def decide(
        self,
        review_id: str,
        decision: str,
        reviewer_id: str,
        reason: str,
    ) -> Optional[dict]:
        if decision not in {"approved", "rejected"}:
            raise ValueError("Decision must be 'approved' or 'rejected'.")

        if not reviewer_id.strip():
            raise ValueError("Reviewer ID is required.")

        if not reason.strip():
            raise ValueError("A decision reason is required.")

        with self._connect() as conn:
            cursor = conn.execute(
                """
                UPDATE human_reviews
                SET status = ?,
                    decided_at = ?,
                    reviewer_id = ?,
                    decision_reason = ?
                WHERE id = ? AND status = 'pending'
                """,
                (
                    decision,
                    utc_now(),
                    reviewer_id.strip(),
                    reason.strip(),
                    review_id,
                ),
            )

            if cursor.rowcount != 1:
                return None

        return self.get_review(review_id)

    def update_edd_status(
        self,
        review_id: str,
        edd_status: str,
    ) -> Optional[dict]:
        allowed_statuses = {
            "not_started",
            "in_progress",
            "completed",
        }

        if edd_status not in allowed_statuses:
            raise ValueError("Invalid EDD status.")

        with self._connect() as conn:
            cursor = conn.execute(
                """
                UPDATE human_reviews
                SET edd_status = ?
                WHERE id = ?
                  AND status = 'approved'
                """,
                (edd_status, review_id),
            )

            if cursor.rowcount != 1:
                return None

        return self.get_review(review_id)


    def record_senior_approval(
        self,
        review_id: str,
        decision: str,
        reviewer_id: str,
        reason: str,
    ) -> Optional[dict]:
        if decision not in {"approved", "rejected"}:
            raise ValueError("Invalid senior approval decision.")

        if not reviewer_id.strip():
            raise ValueError("Senior reviewer ID is required.")

        if not reason.strip():
            raise ValueError("A senior approval reason is required.")

        with self._connect() as conn:
            cursor = conn.execute(
                """
                UPDATE human_reviews
                SET senior_approval_status = ?,
                    senior_reviewer_id = ?,
                    senior_approval_reason = ?,
                    senior_decided_at = ?
                WHERE id = ?
                  AND status = 'approved'
                  AND edd_status = 'completed'
                  AND senior_approval_status = 'not_started'
                """,
                (
                    decision,
                    reviewer_id.strip(),
                    reason.strip(),
                    utc_now(),
                    review_id,
                ),
            )

            if cursor.rowcount != 1:
                return None

        return self.get_review(review_id)

    @staticmethod
    def _serialize(row: sqlite3.Row) -> dict:
        result = dict(row)
        result["context"] = json.loads(result.pop("context_json"))
        return result
