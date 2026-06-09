"""
Step 1: OBSERVE - Query SQLite for traces with failures.
"""

import sqlite3
from pathlib import Path

from config import settings
from models import TraceInput, TraceSpan
from victim.router_agent import infer_failure_type

DB_PATH = Path(__file__).parent.parent / "traces.db"

class Observer:
    """Queries local SQLite DB for failed traces."""

    async def observe(self, hours_back: int = 1, limit: int = 50) -> list[TraceSpan]:
        print("[OBSERVE] Scanning local SQLite for failed traces...")

        failed_spans: list[TraceSpan] = []
        try:
            # Use the same DB path as victim_agent
            with sqlite3.connect(str(DB_PATH)) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()

                # Query for traces where accuracy < threshold
                query = "SELECT * FROM traces WHERE score < ? ORDER BY timestamp DESC LIMIT ?"
                cursor.execute(query, (settings.FAILURE_THRESHOLD, limit))

                rows = cursor.fetchall()
                for row in rows:
                    # The victim_agent saves a flat record, we map it to TraceSpan
                    failed_spans.append(self._parse_row(row))

        except Exception as e:
            print(f"  [ERROR] SQLite observation failed: {e}")

        print(f"  Found {len(failed_spans)} failed spans in local DB.")
        return failed_spans

    def _parse_row(self, row: sqlite3.Row) -> TraceSpan:
        failure_type = infer_failure_type(
            row["company_name"],
            int(row["company_size"]),
            row["industry"],
            row["expected"],
        )
        return TraceSpan(
            span_id=row["span_id"] if "span_id" in row.keys() else "unknown",
            trace_id=row["trace_id"] if "trace_id" in row.keys() else "unknown",
            name="router.route_lead",
            input=TraceInput(
                company_name=row["company_name"],
                company_size=int(row["company_size"]),
                industry=row["industry"],
            ),
            output=row["prediction"],
            expected=row["expected"],
            score=float(row["score"]),
            attributes={
                "failure.type": failure_type,
                "prompt.version": row["prompt_version"] if "prompt_version" in row.keys() else "unknown",
                "storage.backend": "sqlite",
            },
        )
