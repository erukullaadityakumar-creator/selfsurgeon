"""
Phoenix REST API Client — Real Arize Phoenix Integration
"""

import json, os, time
from datetime import datetime
from typing import Any, Dict, List, Optional
import httpx
from dotenv import load_dotenv

load_dotenv()

try:
    from phoenix.client import Client as PhoenixSDK
    from phoenix.client.types.prompts import PromptVersion
    HAS_PHOENIX_SDK = True
except ImportError:
    HAS_PHOENIX_SDK = False

DEFAULT_TIMEOUT = 30

def _ensure_sdk():
    if not HAS_PHOENIX_SDK:
        raise RuntimeError("Install: pip install arize-phoenix-client")

class PhoenixClient:
    def __init__(self, base_url=None):
        self.base_url = (base_url or os.getenv("ARIZE_PHOENIX_HOST", "http://localhost:6006")).rstrip("/")
        self._http = httpx.Client(base_url=self.base_url, timeout=DEFAULT_TIMEOUT)
        self._sdk = PhoenixSDK(base_url=self.base_url) if HAS_PHOENIX_SDK else None

    def list_traces(self, project_name="selfsurgeon-victim", limit=50, filter_condition=None):
        params = {"limit": limit}
        if filter_condition:
            params["filter"] = filter_condition
        resp = self._http.get(f"/v1/projects/{project_name}/traces", params=params)
        resp.raise_for_status()
        return resp.json().get("data", [])

    def get_trace(self, trace_id):
        resp = self._http.get(f"/v1/traces/{trace_id}")
        resp.raise_for_status()
        return resp.json().get("data", {})

    def get_spans(self, trace_id, project_name="selfsurgeon-victim"):
        resp = self._http.get(f"/v1/projects/{project_name}/spans", params={"trace_id": trace_id})
        resp.raise_for_status()
        return resp.json().get("data", [])

    def list_datasets(self):
        _ensure_sdk()
        return self._sdk.datasets.list()

    def get_dataset(self, dataset_name):
        _ensure_sdk()
        return self._sdk.datasets.get_dataset(dataset=dataset_name)

    def create_dataset(self, name, examples, description=None):
        _ensure_sdk()
        return self._sdk.datasets.create_dataset(name=name, examples=examples, dataset_description=description)

    def add_dataset_examples(self, dataset_name, examples):
        _ensure_sdk()
        return self._sdk.datasets.add_examples_to_dataset(dataset=dataset_name, examples=examples)

    def get_latest_prompt(self, prompt_name):
        _ensure_sdk()
        try:
            pv = self._sdk.prompts.get(prompt_identifier=prompt_name)
            return {"id": pv.id, "template": self._extract_template(pv), "version_id": pv.id}
        except Exception:
            return {"id": None, "template": None, "version_id": None}

    def upsert_prompt(self, prompt_name, template, changelog=None):
        _ensure_sdk()
        pv = PromptVersion(
            [{"role": "user", "content": template}],
            model_name="gemini-2.5-flash",
            model_provider="GOOGLE",
            template_format="MUSTACHE",
            description=changelog or "",
        )
        result = self._sdk.prompts.create(name=prompt_name, version=pv, prompt_description=changelog or "")
        return {"id": result.id, "prompt_name": prompt_name, "version_id": result.id, "changelog": changelog or ""}

    def tag_prompt_version(self, prompt_version_id, tag):
        _ensure_sdk()
        self._sdk.prompts.tags.create(prompt_version_id=prompt_version_id, name=tag, description=f"Tagged as {tag}")

    def create_experiment(self, dataset_id, name=None, metadata=None, repetitions=1):
        _ensure_sdk()
        payload = {"repetitions": repetitions}
        if name: payload["name"] = name
        if metadata: payload["metadata"] = metadata
        ds = self._sdk.datasets.get_dataset(dataset=dataset_id)
        resp = self._http.post(f"/v1/datasets/{ds.id}/experiments", json=payload)
        resp.raise_for_status()
        return resp.json()["data"]

    def get_experiment(self, experiment_id):
        resp = self._http.get(f"/v1/experiments/{experiment_id}")
        resp.raise_for_status()
        return resp.json()["data"]

    def get_experiment_runs(self, experiment_id):
        resp = self._http.get(f"/v1/experiments/{experiment_id}/runs")
        resp.raise_for_status()
        return resp.json().get("data", [])

    def create_experiment_run(self, experiment_id, dataset_example_id, output, repetition_number=1, trace_id=None, error=None):
        payload = {"dataset_example_id": dataset_example_id, "output": output, "repetition_number": repetition_number}
        if trace_id: payload["trace_id"] = trace_id
        if error: payload["error"] = error
        resp = self._http.post(f"/v1/experiments/{experiment_id}/runs", json=payload)
        resp.raise_for_status()
        return resp.json()["data"]

    def submit_evaluation(self, experiment_run_id, name, score=None, label=None, explanation=None, annotator_kind="CODE"):
        payload = {"experiment_run_id": experiment_run_id, "name": name, "annotator_kind": annotator_kind}
        if score is not None: payload["score"] = score
        if label is not None: payload["label"] = label
        if explanation is not None: payload["explanation"] = explanation
        resp = self._http.post("/v1/experiment_evaluations", json=payload)
        resp.raise_for_status()
        return resp.json()

    def ensure_dataset_exists(self, name, description=None):
        try:
            return self.get_dataset(name).id
        except Exception:
            self.create_dataset(name=name, examples=[{"input": {"init": True}, "output": {"init": True}}], description=description)
            return self.get_dataset(name).id

    def _extract_template(self, pv):
        try:
            td = pv._PromptVersion__dict__.get("_template", {})
            for m in td.get("messages", []):
                if m.get("role") in ("user", "system"):
                    c = m.get("content", "")
                    if isinstance(c, list):
                        for part in c:
                            if isinstance(part, dict) and part.get("type") == "text":
                                return part["text"]
                    return str(c)
            return ""
        except Exception:
            return str(pv)

    def close(self):
        self._http.close()

    def __enter__(self): return self
    def __exit__(self, *args): self.close()
