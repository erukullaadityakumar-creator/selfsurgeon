"""
Typed wrappers around optional legacy tool adapters.

The current demo reads traces from SQLite and uses the local prompt registry.
These wrappers remain for earlier Phoenix/MCP compatibility paths.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from config import settings
from services.phoenix_service import phoenix_service

from .client import MCPError, get_mcp_client


class ArizeTools:
    """High-level interface to optional legacy Phoenix/MCP tools."""

    async def _call(self, candidates: list[str], params: dict, fallback):
        try:
            client = await get_mcp_client()
            available = {tool["name"] for tool in client.tools}
            for name in candidates:
                if name in available:
                    return await client.call_tool(name, params)
            raise MCPError(f"No MCP tool found among {candidates}")
        except Exception as exc:
            print(f"[MCP:FALLBACK] {exc}")
            return await fallback()

    async def list_traces(self, project_name: str, start_time: Optional[str] = None, end_time: Optional[str] = None, limit: int = 50, filter_condition: Optional[str] = None) -> dict:
        return await self._call(
            ["list-traces", "arize_list_traces", "list_traces"],
            {"project_name": project_name, "start_time": start_time or datetime.now().isoformat(), "end_time": end_time, "limit": limit, "filter": filter_condition},
            lambda: phoenix_service.list_traces(project_name, limit=limit, failed_only=bool(filter_condition)),
        )

    async def get_trace(self, trace_id: str) -> dict:
        spans = await self.get_spans(trace_id)
        return {"id": trace_id, "spans": spans.get("spans", [])}

    async def get_spans(self, trace_id: str) -> dict:
        return await self._call(
            ["get-spans", "arize_get_spans", "get_spans"],
            {"trace_id": trace_id},
            lambda: phoenix_service.get_spans(settings.PROJECT_NAME, trace_id=trace_id),
        )

    async def get_span(self, trace_id: str, span_id: str) -> dict:
        spans = await self.get_spans(trace_id)
        for span in spans.get("spans", []):
            if span.get("span_id") == span_id:
                return span
        return {}

    async def get_span_annotations(self, trace_id: str, span_id: str) -> dict:
        span = await self.get_span(trace_id, span_id)
        return {"trace_id": trace_id, "span_id": span_id, "annotations": {"score": span.get("score", 1.0)}}

    async def list_datasets(self, project_name: str) -> dict:
        return await self._call(
            ["list-datasets", "arize_list_datasets", "list_datasets"],
            {"project_name": project_name},
            phoenix_service.list_datasets,
        )

    async def get_dataset_examples(self, dataset_id: str, limit: int = 100) -> dict:
        return await self._call(
            ["get-dataset-examples", "arize_get_dataset_examples", "get_dataset_examples"],
            {"dataset_id": dataset_id, "limit": limit},
            lambda: phoenix_service.get_dataset_examples(dataset_id, limit),
        )

    async def add_dataset_examples(self, dataset_id: str, examples: list) -> dict:
        return await self._call(
            ["add-dataset-examples", "arize_add_dataset_examples", "add_dataset_examples"],
            {"dataset_id": dataset_id, "examples": examples},
            lambda: phoenix_service.add_dataset_examples(dataset_id, examples),
        )

    async def upsert_prompt(self, prompt_name: str, version: str, template: str, changelog: str) -> dict:
        return await self._call(
            ["upsert-prompt", "arize_upsert_prompt", "upsert_prompt"],
            {"prompt_name": prompt_name, "version": version, "template": template, "changelog": changelog},
            lambda: phoenix_service.upsert_prompt(prompt_name, version, template, changelog),
        )

    async def get_latest_prompt(self, prompt_name: str) -> dict:
        return await self._call(
            ["get-latest-prompt", "arize_get_latest_prompt", "get_latest_prompt"],
            {"prompt_name": prompt_name},
            lambda: phoenix_service.get_latest_prompt(prompt_name),
        )

    async def add_prompt_version_tag(self, prompt_name: str, version: str, tag: str) -> dict:
        return await self._call(
            ["add-prompt-version-tag", "arize_add_prompt_version_tag", "add_prompt_version_tag"],
            {"prompt_name": prompt_name, "version": version, "tag": tag},
            lambda: phoenix_service.add_prompt_version_tag(prompt_name, version, tag),
        )

    async def run_experiment(self, dataset_id: str, baseline_prompt_version: str, candidate_prompt_version: str, evaluators: list[str]) -> dict:
        return await self._call(
            ["run-experiment", "arize_run_experiment", "run_experiment"],
            {"dataset_id": dataset_id, "baseline_prompt_version": baseline_prompt_version, "candidate_prompt_version": candidate_prompt_version, "evaluators": evaluators},
            lambda: phoenix_service.run_experiment(dataset_id, baseline_prompt_version, candidate_prompt_version),
        )

    async def get_experiment_by_id(self, experiment_id: str) -> dict:
        return await self._call(
            ["get-experiment-by-id", "arize_get_experiment_by_id", "get_experiment_by_id"],
            {"experiment_id": experiment_id},
            lambda: phoenix_service.get_experiment_by_id(experiment_id),
        )


arize_tools = ArizeTools()
