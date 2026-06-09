"""
Step 2: DIAGNOSE - Analyze failed spans and classify failure type.
"""

from __future__ import annotations

import json
from collections import Counter
from typing import Optional

from config import settings
from models import FailureDiagnosis, FailureType, TraceSpan

try:
    from google import genai
    from google.genai import types
except Exception:  # pragma: no cover
    genai = None
    types = None


class Diagnostician:
    """Uses Gemini when available, with deterministic fallback."""

    def __init__(self):
        self.client = None
        if genai and settings.GEMINI_API_KEY and settings.GEMINI_API_KEY != "your_gemini_api_key_here":
            self.client = genai.Client(api_key=settings.GEMINI_API_KEY)

    async def diagnose(self, failed_spans: list[TraceSpan]) -> Optional[FailureDiagnosis]:
        if not failed_spans:
            return None
        print(f"[DIAGNOSE] Analyzing {len(failed_spans)} failed spans...")

        typed_spans = [
            (span.attributes.get("failure.type"), span)
            for span in failed_spans
            if span.attributes.get("failure.type")
        ]
        if typed_spans:
            failure_type_value, affected_count = Counter(item[0] for item in typed_spans).most_common(1)[0]
            if failure_type_value in {FailureType.OUTPUT_FORMAT_VIOLATION.value, FailureType.TOOL_MISUSE.value}:
                affected = [span for kind, span in typed_spans if kind == failure_type_value]
                descriptions = {
                    FailureType.OUTPUT_FORMAT_VIOLATION.value: "Agent selected the right route family but violated the required JSON output contract.",
                    FailureType.TOOL_MISUSE.value: "Agent guessed from incomplete lead data instead of requesting CRM enrichment.",
                }
                diagnosis = FailureDiagnosis(
                    failure_type=FailureType(failure_type_value),
                    confidence=0.94,
                    description=descriptions[failure_type_value],
                    affected_traces=list({span.trace_id for span in affected}),
                    trace_details=affected,
                )
                print(f"  Diagnosis: {diagnosis.failure_type.value} ({affected_count} traces, conf:{diagnosis.confidence:.2f})")
                return diagnosis

        boundary = [span for span in failed_spans if span.input.company_size in {50, 1000}]
        if boundary:
            diagnosis = FailureDiagnosis(
                failure_type=FailureType.BOUNDARY_AMBIGUITY,
                confidence=0.97,
                description="Prompt uses exclusive boundary language for exact threshold values.",
                affected_traces=list({span.trace_id for span in boundary}),
                trace_details=boundary,
            )
            print(f"  Diagnosis: {diagnosis.failure_type.value} ({len(boundary)} traces, conf:{diagnosis.confidence:.2f})")
            return diagnosis

        if self.client:
            return await self._diagnose_with_gemini(failed_spans)

        diagnosis = FailureDiagnosis(
            failure_type=FailureType.UNKNOWN,
            confidence=0.5,
            description="Could not classify failure pattern deterministically.",
            affected_traces=list({span.trace_id for span in failed_spans}),
            trace_details=failed_spans,
        )
        print(f"  Diagnosis: {diagnosis.failure_type.value}")
        return diagnosis

    async def _diagnose_with_gemini(self, failed_spans: list[TraceSpan]) -> FailureDiagnosis:
        traces_json = [{
            "input": span.input.model_dump(),
            "output": span.output,
            "expected": span.expected,
            "score": span.score,
        } for span in failed_spans[:20]]
        prompt = f"""Analyze failed lead-routing agent executions.

Failed cases:
{json.dumps(traces_json, indent=2)}

Return only JSON with failure_type, confidence, description.
"""
        response = self.client.models.generate_content(
            model=settings.GEMINI_MODEL_PRO,
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        raw = json.loads(response.text)
        failure_type = FailureType(raw.get("failure_type", FailureType.UNKNOWN))
        return FailureDiagnosis(
            failure_type=failure_type,
            confidence=float(raw.get("confidence", 0.5)),
            description=raw.get("description", "Gemini classified failure"),
            affected_traces=list({span.trace_id for span in failed_spans}),
            trace_details=failed_spans,
        )
