
"""
The "patient" agent: intentionally flawed lead router backed by SQLite traces.
"""

from __future__ import annotations

import asyncio
import json
import os
import random
import secrets
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import requests

from config import settings

try:
    from google import genai
    from google.genai import types
except Exception:  # pragma: no cover
    genai = None
    types = None


DB_PATH = Path(__file__).resolve().parents[1] / "traces.db"

FLAWED_PROMPT_V1 = """You are a lead router. Route leads based on company_size:
- "small": under 50 employees -> route to SMB_SDR
- "enterprise": over 1000 employees -> route to ENT_AE
- "mid-market": everything else -> route to MM_REP

Input: {company_name}, {company_size}, {industry}
Output ONLY the route: SMB_SDR, MM_REP, or ENT_AE"""

_CURRENT_PROMPT_CACHE: str | None = None


def get_current_prompt() -> str:
    """Fetch the current deployed prompt from the backend registry."""
    global _CURRENT_PROMPT_CACHE

    try:
        response = requests.get(
            "http://localhost:8000/api/prompts/current",
            timeout=15,
        )
        data = response.json()
        if data.get("success") and data.get("data", {}).get("template"):
            _CURRENT_PROMPT_CACHE = data["data"]["template"]
            return _CURRENT_PROMPT_CACHE
    except Exception as exc:
        print(f"Prompt fetch failed, using fallback flawed prompt: {exc}")

    return _CURRENT_PROMPT_CACHE or FLAWED_PROMPT_V1


def get_prompt_version_label(prompt_text: str) -> str:
    """Tag which prompt version was used for easier debugging/demo clarity."""
    normalized = " ".join(prompt_text.lower().split())

    if (
        "50 or fewer" in normalized
        or "1000 or more" in normalized
        or "json object" in normalized
        or "crm_lookup" in normalized
    ):
        return "deployed_current"

    return "flawed_v1"


def infer_failure_type(company_name: str, company_size: int, industry: str, expected: str) -> str:
    normalized = f"{company_name} {industry} {expected}".lower()
    if "format" in normalized or expected.startswith("{"):
        return "OUTPUT_FORMAT_VIOLATION"
    if "tool" in normalized or "crm_lookup" in normalized or company_size <= 0:
        return "TOOL_MISUSE"
    return "BOUNDARY_AMBIGUITY"


def init_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS traces (
                id TEXT PRIMARY KEY,
                trace_id TEXT NOT NULL,
                span_id TEXT NOT NULL,
                company_name TEXT NOT NULL,
                company_size INTEGER NOT NULL,
                industry TEXT NOT NULL,
                prediction TEXT NOT NULL,
                expected TEXT NOT NULL,
                score REAL NOT NULL,
                prompt_version TEXT NOT NULL,
                timestamp TEXT NOT NULL
            )
            """
        )
        conn.commit()


def save_trace(trace_data: dict) -> dict:
    init_db()
    trace_id = trace_data.get("trace_id") or secrets.token_hex(16)
    span_id = trace_data.get("span_id") or secrets.token_hex(8)
    row_id = trace_data.get("id") or f"{trace_data['company_name']}_{trace_data['timestamp']}_{span_id}"

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO traces
            (id, trace_id, span_id, company_name, company_size, industry, prediction, expected, score, prompt_version, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                row_id,
                trace_id,
                span_id,
                trace_data["company_name"],
                trace_data["company_size"],
                trace_data["industry"],
                trace_data["prediction"],
                trace_data["expected"],
                trace_data["score"],
                trace_data.get("prompt_version", "flawed_v1"),
                trace_data["timestamp"],
            ),
        )
        conn.commit()

    return {"id": row_id, "trace_id": trace_id, "span_id": span_id}


def _row_to_span(row: sqlite3.Row) -> dict:
    failure_type = infer_failure_type(
        row["company_name"],
        int(row["company_size"]),
        row["industry"],
        row["expected"],
    )
    attrs = {
        "selfsurgeon.kind": "victim_route",
        "failure.type": failure_type,
        "selfsurgeon.accuracy": row["score"],
        "selfsurgeon.is_correct": row["score"] >= 1.0,
        "input.company_name": row["company_name"],
        "input.company_size": row["company_size"],
        "input.industry": row["industry"],
        "output.route": row["prediction"],
        "expected.route": row["expected"],
        "prompt.name": settings.PROMPT_REGISTRY_NAME,
        "prompt.version": row["prompt_version"],
        "storage.backend": "sqlite",
    }
    return {
        "span_id": row["span_id"],
        "trace_id": row["trace_id"],
        "name": "router.route_lead",
        "input": {
            "company_name": row["company_name"],
            "company_size": row["company_size"],
            "industry": row["industry"],
        },
        "output": row["prediction"],
        "expected": row["expected"],
        "score": float(row["score"]),
        "timestamp": row["timestamp"],
        "attributes": attrs,
    }


def get_saved_spans(trace_id: str | None = None, limit: int = 100, failed_only: bool = False) -> list[dict]:
    init_db()
    query = "SELECT * FROM traces"
    params: list[object] = []
    filters: list[str] = []
    if trace_id:
        filters.append("trace_id = ?")
        params.append(trace_id)
    if failed_only:
        filters.append("score < ?")
        params.append(settings.FAILURE_THRESHOLD)
    if filters:
        query += " WHERE " + " AND ".join(filters)
    query += " ORDER BY timestamp DESC LIMIT ?"
    params.append(limit)

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        return [_row_to_span(row) for row in conn.execute(query, params).fetchall()]


def list_saved_traces(limit: int = 50, failed_only: bool = False) -> dict:
    spans = get_saved_spans(limit=limit, failed_only=failed_only)
    traces = [
        {
            "id": span["trace_id"],
            "project_name": settings.PROJECT_NAME,
            "status": "error" if span["score"] < settings.FAILURE_THRESHOLD else "ok",
            "score": span["score"],
            "timestamp": span["timestamp"],
            "spans": [span],
        }
        for span in spans
    ]
    return {"traces": traces}


def ground_truth(company_size: int) -> str:
    if company_size <= 50:
        return "SMB_SDR"
    if company_size >= 1000:
        return "ENT_AE"
    return "MM_REP"


def json_expected_route(company_size: int) -> str:
    return json.dumps({"route": ground_truth(company_size)}, separators=(",", ":"))


def flawed_route(company_size: int) -> str:
    if company_size < 50:
        return "SMB_SDR"
    if company_size > 1000:
        return "ENT_AE"
    return "MM_REP"


def smart_route(company_size: int, prompt_text: str) -> str:
    """Route deterministically, respecting whether the prompt has been fixed."""
    normalized = " ".join(prompt_text.lower().split())
    if "50 or fewer" in normalized or "1000 or more" in normalized:
        if company_size <= 50:
            return "SMB_SDR"
        if company_size >= 1000:
            return "ENT_AE"
        return "MM_REP"
    return flawed_route(company_size)


def smart_route_for_failure(company_size: int, prompt_text: str, failure_type: str) -> tuple[str, str]:
    """Return prediction and expected output for the selected demo failure class."""
    normalized = " ".join(prompt_text.lower().split())
    failure_type = failure_type.upper()

    if failure_type == "OUTPUT_FORMAT_VIOLATION":
        expected = json_expected_route(company_size)
        route = smart_route(company_size, prompt_text)
        if "json object" in normalized and '"route"' in normalized:
            return json.dumps({"route": route}, separators=(",", ":")), expected
        return route, expected

    if failure_type == "TOOL_MISUSE":
        expected = "CRM_LOOKUP" if company_size <= 0 else ground_truth(company_size)
        if company_size <= 0 and "crm_lookup" in normalized:
            return "CRM_LOOKUP", expected
        return flawed_route(company_size), expected

    return smart_route(company_size, prompt_text), ground_truth(company_size)


async def route_lead(company_name: str, company_size: int, industry: str, failure_type: str = "BOUNDARY_AMBIGUITY") -> dict:
    """Route a lead and persist a SQLite trace."""
    current_prompt = await asyncio.to_thread(get_current_prompt)
    prompt_version = get_prompt_version_label(current_prompt)

    prediction, correct = smart_route_for_failure(company_size, current_prompt, failure_type)

    if settings.USE_GEMINI_ROUTER and genai and types and settings.GEMINI_API_KEY:
        try:
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=[f"Route this lead: {company_name}, {company_size} employees, {industry}"],
                config=types.GenerateContentConfig(system_instruction=current_prompt),
            )
            raw_text = response.text.strip()
            raw = raw_text.upper()
            if failure_type.upper() == "OUTPUT_FORMAT_VIOLATION" and raw_text.startswith("{"):
                prediction = raw_text.replace(" ", "")
            elif failure_type.upper() == "TOOL_MISUSE" and "CRM_LOOKUP" in raw:
                prediction = "CRM_LOOKUP"
            elif "SMB" in raw:
                prediction = "SMB_SDR"
            elif "ENT" in raw:
                prediction = "ENT_AE"
            elif "MM" in raw:
                prediction = "MM_REP"
        except Exception as exc:
            print(f"Gemini router error (falling back to deterministic): {exc}")

    score = 1.0 if prediction == correct else 0.0
    result = {
        "company_name": company_name,
        "company_size": company_size,
        "industry": industry,
        "prediction": prediction,
        "expected": correct,
        "score": score,
        "is_correct": score == 1.0,
        "prompt_version": prompt_version,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    result.update(save_trace(result))
    print(
        f"[{datetime.now():%H:%M:%S}] "
        f"{company_name}({company_size}) -> pred:{prediction} true:{correct} score:{score} prompt:{prompt_version}"
    )
    return result


async def generate_failure_traces(count: int = 50, failure_type: str = "BOUNDARY_AMBIGUITY") -> list[dict]:
    """Generate traces with known failure patterns."""
    init_db()
    random.seed(42)
    failure_type = failure_type.upper()
    test_cases: list[tuple[str, int, str]] = []

    if failure_type == "OUTPUT_FORMAT_VIOLATION":
        for i in range(count):
            test_cases.append((f"FormatCorp_{i}", random.choice([25, 100, 5000]), "format-compliance"))
    elif failure_type == "TOOL_MISUSE":
        for i in range(count):
            test_cases.append((f"ToolLookup_{i}", 0, "tool-enrichment"))
    else:
        failure_type = "BOUNDARY_AMBIGUITY"
        for i in range(int(count * 0.4)):
            test_cases.append((f"BoundaryCorp_{i}", 50 if i % 2 == 0 else 1000, "saas"))
        for i in range(int(count * 0.3)):
            test_cases.append((f"NearBoundary_{i}", random.choice([49, 51, 999, 1001]), "fintech"))
        for i in range(count - len(test_cases)):
            test_cases.append((f"ClearCase_{i}", random.choice([25, 100, 5000]), "healthcare"))

    results = []
    for name, size, industry in test_cases:
        results.append(await route_lead(name, size, industry, failure_type))
        await asyncio.sleep(0.05)

    failures = [r for r in results if r["score"] == 0]
    print(f"\n{'=' * 50}")
    print(f"TOTAL: {len(results)}")
    print(f"FAILURES: {len(failures)} ({len(failures) / len(results) * 100:.1f}%)")
    print(f"FAILURE SIZES: {sorted(set(r['company_size'] for r in failures))}")
    print(f"{'=' * 50}")
    return results


if __name__ == "__main__":
    asyncio.run(generate_failure_traces(int(os.getenv("TRACE_COUNT", "50"))))
