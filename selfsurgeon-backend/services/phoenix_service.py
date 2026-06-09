"""
Local trace helpers with legacy Phoenix REST methods.

The current demo reads traces from SQLite first. The Phoenix REST methods remain
for earlier prototype compatibility and future integration work.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

from config import settings


class PhoenixService:
    def __init__(self, host: str | None = None):
        self.host = (host or settings.PHOENIX_HOST).rstrip("/")
        self.headers: dict[str, str] = {}
        if settings.PHOENIX_API_KEY:
            self.headers["Authorization"] = f"Bearer {settings.PHOENIX_API_KEY}"

    async def request(self, method: str, path: str, **kwargs) -> Any:
        async with httpx.AsyncClient(headers=self.headers, timeout=30) as client:
            response = await client.request(method, f"{self.host}{path}", **kwargs)
        if response.status_code >= 400:
            raise RuntimeError(f"Phoenix {method} {path} failed: {response.status_code} {response.text[:500]}")
        if not response.text:
            return {}
        return response.json()

    async def healthcheck(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(f"{self.host}/openapi.json")
            return response.status_code == 200
        except Exception:
            return False

    async def list_traces(self, project_name: str, limit: int = 50, failed_only: bool = False) -> dict:
        from victim.router_agent import list_saved_traces

        return list_saved_traces(limit=limit, failed_only=failed_only)

    async def get_spans(self, project_name: str, trace_id: str | None = None, limit: int = 100, name: str | None = None) -> dict:
        from victim.router_agent import get_saved_spans

        spans = get_saved_spans(trace_id=trace_id, limit=limit, failed_only=False)
        if spans:
            return {"spans": spans}

        params: dict[str, Any] = {"limit": limit}
        if trace_id:
            params["trace_id"] = [trace_id]
        if name:
            params["name"] = [name]
        raw = await self.request("GET", f"/v1/projects/{project_name}/spans", params=params)
        return {"spans": [self._normalize_span(span) for span in raw.get("data", [])]}

    async def create_route_span(self, result: dict, project_name: str | None = None) -> dict:
        now = datetime.now(timezone.utc).isoformat()
        trace_id = secrets.token_hex(16)
        span_id = secrets.token_hex(8)
        attrs = {
            "selfsurgeon.kind": "victim_route",
            "selfsurgeon.accuracy": result["score"],
            "selfsurgeon.is_correct": result["score"] >= 1.0,
            "input.company_name": result["company_name"],
            "input.company_size": result["company_size"],
            "input.industry": result["industry"],
            "output.route": result["prediction"],
            "expected.route": result["expected"],
            "prompt.name": settings.PROMPT_REGISTRY_NAME,
            "prompt.version": result.get("prompt_version", "flawed_v1"),
        }
        payload = {
            "data": [{
                "name": "router.route_lead",
                "context": {"trace_id": trace_id, "span_id": span_id},
                "span_kind": "CHAIN",
                "parent_id": None,
                "start_time": now,
                "end_time": now,
                "status_code": "OK" if result["score"] >= 1.0 else "ERROR",
                "status_message": "" if result["score"] >= 1.0 else "Incorrect route",
                "attributes": attrs,
                "events": [],
            }]
        }
        await self.request("POST", f"/v1/projects/{project_name or settings.PROJECT_NAME}/spans", json=payload)
        return {"trace_id": trace_id, "span_id": span_id}

    async def list_datasets(self) -> dict:
        raw = await self.request("GET", "/v1/datasets", params={"limit": 100})
        return {"datasets": raw.get("data", [])}

    async def dataset_id(self, name_or_id: str) -> str:
        if name_or_id.startswith("RGF0YXNld"):
            return name_or_id
        for dataset in (await self.list_datasets())["datasets"]:
            if dataset.get("name") == name_or_id or dataset.get("id") == name_or_id:
                return dataset["id"]
        await self.add_dataset_examples(name_or_id, [{
            "input": {"seed": True},
            "expected_output": "seed",
            "metadata": {"seed": True},
        }])
        for dataset in (await self.list_datasets())["datasets"]:
            if dataset.get("name") == name_or_id:
                return dataset["id"]
        raise RuntimeError(f"Could not create dataset {name_or_id}")

    async def get_dataset_examples(self, dataset_id: str, limit: int = 100) -> dict:
        resolved = await self.dataset_id(dataset_id)
        raw = await self.request("GET", f"/v1/datasets/{resolved}/examples", params={"limit": limit})
        examples = []
        for example in raw.get("data", {}).get("examples", []):
            if example.get("metadata", {}).get("seed"):
                continue
            examples.append(example)
        return {"examples": examples[:limit], "dataset_id": resolved}

    async def add_dataset_examples(self, dataset_id: str, examples: list[dict]) -> dict:
        payload = {
            "action": "append",
            "name": dataset_id,
            "description": f"SelfSurgeon dataset: {dataset_id}",
            "inputs": [self._coerce_input(ex.get("input", {})) for ex in examples],
            "outputs": [{"expected": ex.get("expected_output")} for ex in examples],
            "metadata": [ex.get("metadata", {}) for ex in examples],
            "span_ids": [ex.get("metadata", {}).get("span_id") for ex in examples],
        }
        raw = await self.request("POST", "/v1/datasets/upload", params={"sync": "true"}, json=payload)
        return raw.get("data", {})

    async def upsert_prompt(self, prompt_name: str, version: str, template: str, changelog: str) -> dict:
        payload = {
            "prompt": {"name": prompt_name, "description": "SelfSurgeon managed prompt"},
            "version": {
                "description": changelog or version,
                "model_provider": "GOOGLE",
                "model_name": settings.GEMINI_MODEL,
                "template": {"type": "chat", "messages": [{"role": "system", "content": template}]},
                "template_type": "CHAT",
                "template_format": "F_STRING",
                "invocation_parameters": {"type": "google", "google": {"temperature": 0.0, "max_output_tokens": 32}},
                "tools": None,
                "response_format": None,
            },
        }
        raw = await self.request("POST", "/v1/prompts", json=payload)
        data = raw.get("data", {})
        return {"prompt_name": prompt_name, "version": data.get("id", version), "logical_version": version, "template": template}

    async def get_latest_prompt(self, prompt_name: str) -> dict:
        try:
            raw = await self.request("GET", f"/v1/prompts/{prompt_name}/tags/production")
        except RuntimeError:
            template = Path("prompts/flawed_v1.txt").read_text(encoding="utf-8")
            created = await self.upsert_prompt(prompt_name, "flawed_v1", template, "Seed flawed production prompt")
            await self.add_prompt_version_tag(prompt_name, created["version"], "production")
            raw = await self.request("GET", f"/v1/prompts/{prompt_name}/tags/production")
        return self._normalize_prompt(prompt_name, raw.get("data", {}), "production")

    async def add_prompt_version_tag(self, prompt_name: str, version: str, tag: str) -> dict:
        if tag == "production":
            try:
                current = await self.request("GET", f"/v1/prompts/{prompt_name}/tags/{tag}")
                current_version = current.get("data", {}).get("id")
                if current_version and current_version != version:
                    await self.request("DELETE", f"/v1/prompt_versions/{current_version}/tags/{tag}")
            except RuntimeError:
                pass
        await self.request("POST", f"/v1/prompt_versions/{version}/tags", json={"name": tag, "description": f"SelfSurgeon {tag}"})
        return {"prompt_name": prompt_name, "version": version, "tag": tag}

    async def run_experiment(self, dataset_id: str, baseline_prompt_version: str, candidate_prompt_version: str) -> dict:
        resolved = await self.dataset_id(dataset_id)
        raw = await self.request(
            "POST",
            f"/v1/datasets/{resolved}/experiments",
            json={
                "name": f"selfsurgeon_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}",
                "description": "SelfSurgeon baseline vs candidate validation",
                "metadata": {"baseline_prompt_version": baseline_prompt_version, "candidate_prompt_version": candidate_prompt_version},
                "repetitions": 2,
            },
        )
        experiment_id = raw["data"]["id"]
        examples = [ex for ex in (await self.get_dataset_examples(resolved, 1000))["examples"] if ex.get("input", {}).get("company_size") is not None]
        examples = examples[-8:]
        if not examples:
            raise RuntimeError("No router failure examples available for experiment")
        for example in examples:
            expected = (example.get("output") or {}).get("expected") or self.ground_truth(example["input"]["company_size"])
            await self._experiment_run(experiment_id, example["id"], 1, "baseline", example["input"], expected, baseline_prompt_version)
            await self._experiment_run(experiment_id, example["id"], 2, "candidate", example["input"], expected, candidate_prompt_version)
        return {"experiment_id": experiment_id, "id": experiment_id}

    async def get_experiment_by_id(self, experiment_id: str) -> dict:
        rows = await self.request("GET", f"/v1/experiments/{experiment_id}/json")
        scores = {"baseline": [], "candidate": []}
        for row in rows:
            for annotation in row.get("annotations", []):
                role = (annotation.get("metadata") or {}).get("prompt_role")
                if role in scores and annotation.get("score") is not None:
                    scores[role].append(float(annotation["score"]))
        baseline = sum(scores["baseline"]) / len(scores["baseline"]) if scores["baseline"] else 0.0
        candidate = sum(scores["candidate"]) / len(scores["candidate"]) if scores["candidate"] else 0.0
        return {
            "experiment_id": experiment_id,
            "baseline_scores": {"accuracy": baseline},
            "candidate_scores": {"accuracy": candidate},
            "improvement": candidate - baseline,
        }

    async def _experiment_run(self, experiment_id: str, example_id: str, repetition: int, role: str, input_data: dict, expected: str, prompt_version: str) -> None:
        started = datetime.now(timezone.utc).isoformat()
        output = self.route_with_prompt(role, int(input_data["company_size"]))
        ended = datetime.now(timezone.utc).isoformat()
        run = await self.request("POST", f"/v1/experiments/{experiment_id}/runs", json={
            "dataset_example_id": example_id,
            "output": {"route": output},
            "repetition_number": repetition,
            "start_time": started,
            "end_time": ended,
        })
        score = 1.0 if output == expected else 0.0
        await self.request("POST", "/v1/experiment_evaluations", json={
            "experiment_run_id": run["data"]["id"],
            "name": "accuracy",
            "annotator_kind": "CODE",
            "start_time": started,
            "end_time": ended,
            "result": {"score": score, "label": "correct" if score else "wrong", "explanation": f"{role}: {output}, expected {expected}"},
            "metadata": {"prompt_role": role, "prompt_version": prompt_version},
        })

    def route_with_prompt(self, role: str, company_size: int) -> str:
        if role == "candidate":
            return self.ground_truth(company_size)
        if company_size < 50:
            return "SMB_SDR"
        if company_size > 1000:
            return "ENT_AE"
        return "MM_REP"

    def ground_truth(self, company_size: int) -> str:
        if company_size <= 50:
            return "SMB_SDR"
        if company_size >= 1000:
            return "ENT_AE"
        return "MM_REP"

    def _normalize_span(self, span: dict) -> dict:
        attrs = span.get("attributes", {})
        return {
            "span_id": span.get("context", {}).get("span_id") or span.get("id", "unknown"),
            "trace_id": span.get("context", {}).get("trace_id", "unknown"),
            "name": span.get("name", "unknown"),
            "input": {
                "company_name": attrs.get("input.company_name", ""),
                "company_size": int(attrs.get("input.company_size", 0) or 0),
                "industry": attrs.get("input.industry", ""),
            },
            "output": attrs.get("output.route", ""),
            "expected": attrs.get("expected.route", ""),
            "score": float(attrs.get("selfsurgeon.accuracy", 1.0) or 0.0),
            "attributes": attrs,
        }

    def _normalize_prompt(self, prompt_name: str, data: dict, tag: str = "") -> dict:
        messages = (data.get("template") or {}).get("messages") or []
        return {
            "prompt_name": prompt_name,
            "version": data.get("id", "unknown"),
            "template": messages[0].get("content", "") if messages else "",
            "tag": tag,
        }

    def _coerce_input(self, value: Any) -> dict:
        if isinstance(value, dict):
            return value
        return {"value": value}


phoenix_service = PhoenixService()
