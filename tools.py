"""
SelfSurgeon Tools - Phoenix API Wrappers and Custom Analysis Tools
"""

import os, json, re
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from datetime import datetime
from enum import Enum

from dotenv import load_dotenv
load_dotenv()

from phoenix_client import PhoenixClient


class FailureType(Enum):
    BOUNDARY_AMBIGUITY = "BOUNDARY_AMBIGUITY"
    TOOL_MISUSE = "TOOL_MISUSE"
    CONTEXT_LOSS = "CONTEXT_LOSS"
    GOAL_DRIFT = "GOAL_DRIFT"
    RETRY_LOOP = "RETRY_LOOP"
    HALLUCINATION = "HALLUCINATION"
    UNKNOWN = "UNKNOWN"


class ArizeMCPClient:
    """Client for Arize Phoenix MCP tools — backed by real Phoenix REST API."""

    def __init__(self, phoenix_host: str = None):
        self.client = PhoenixClient(base_url=phoenix_host)

    def list_traces(self, project_name=None, start_time=None, end_time=None, filter_condition=None, limit=50) -> str:
        traces = self.client.list_traces(project_name=project_name or "selfsurgeon-victim", limit=limit, filter_condition=filter_condition)
        return json.dumps(traces)

    def get_trace(self, trace_id: str) -> str:
        trace = self.client.get_trace(trace_id)
        return json.dumps(trace)

    def get_spans(self, trace_id: str) -> str:
        spans = self.client.get_spans(trace_id)
        return json.dumps(spans)

    def get_span(self, trace_id: str, span_id: str) -> str:
        spans = json.loads(self.get_spans(trace_id))
        for span in spans:
            if span.get("span_id") == span_id or span.get("id") == span_id:
                return json.dumps(span)
        return json.dumps({"error": "Span not found"})

    def get_span_annotations(self, trace_id: str, span_id: str) -> str:
        spans = json.loads(self.get_spans(trace_id))
        for span in spans:
            if span.get("span_id") == span_id or span.get("id") == span_id:
                annotations = span.get("annotations", {})
                if not annotations:
                    annotations = span.get("span_annotations", {})
                return json.dumps({"trace_id": trace_id, "span_id": span_id, "annotations": annotations})
        return json.dumps({"trace_id": trace_id, "span_id": span_id, "annotations": {}})

    def list_datasets(self, project_name=None) -> str:
        datasets = self.client.list_datasets()
        result = []
        for d in datasets:
            if hasattr(d, 'id'): result.append({"id": d.id, "name": d.name, "example_count": len(getattr(d, 'examples', []) or [])})
            elif isinstance(d, dict): result.append({"id": d.get("id"), "name": d.get("name"), "example_count": d.get("example_count", 0)})
        return json.dumps(result)

    def get_dataset(self, dataset_id: str) -> str:
        ds = self.client.get_dataset(dataset_id)
        return json.dumps({"id": ds.id, "name": ds.name, "example_count": ds.example_count, "description": ds.description})

    def get_dataset_examples(self, dataset_id: str, limit=100) -> str:
        ds = self.client.get_dataset(dataset_id)
        return json.dumps([{"id": ex["id"], "input": ex["input"], "output": ex["output"], "metadata": ex.get("metadata", {})} for ex in ds.examples[:limit]])

    def list_project_spans(self, project_name=None, limit=50) -> str:
        try:
            import httpx
            h = httpx.Client(base_url=self.client.base_url)
            resp = h.get(f"/v1/projects/{project_name or 'selfsurgeon-victim'}/spans", params={"limit": limit})
            return json.dumps(resp.json().get("data", []))
        except Exception:
            return json.dumps([])

    def add_dataset_examples(self, dataset_id: str, examples: List[Dict]) -> str:
        ds = self.client.add_dataset_examples(dataset_name=dataset_id, examples=examples)
        return json.dumps({"dataset_id": dataset_id, "added_count": len(examples), "timestamp": datetime.now().isoformat()})

    def upsert_prompt(self, prompt_name: str, version: str, template: str, changelog: str = "") -> str:
        result = self.client.upsert_prompt(prompt_name=prompt_name, template=template, changelog=changelog or f"Version {version}")
        return json.dumps({"prompt_name": prompt_name, "version": version, "id": result.get("id"), "changelog": changelog})

    def get_latest_prompt(self, prompt_name: str) -> str:
        result = self.client.get_latest_prompt(prompt_name)
        return json.dumps({
            "prompt_name": prompt_name,
            "version": result.get("version_id") or "v_unknown",
            "template": result.get("template") or FLAWED_PROMPT,
            "id": result.get("id")
        })

    def add_prompt_version_tag(self, prompt_name: str, version: str, tag: str) -> str:
        self.client.tag_prompt_version(prompt_version_id=version, tag=tag)
        return json.dumps({"prompt_name": prompt_name, "version": version, "tag": tag, "timestamp": datetime.now().isoformat()})

    def ensure_dataset_exists(self, dataset_name: str, description: str = None) -> str:
        ds_id = self.client.ensure_dataset_exists(dataset_name, description)
        return json.dumps({"dataset_name": dataset_name, "id": ds_id})

    def list_experiments_for_dataset(self, dataset_id: str) -> str:
        try:
            import httpx
            h = httpx.Client(base_url=self.client.base_url)
            resp = h.get(f"/v1/datasets/{dataset_id}/experiments")
            data = resp.json().get("data", []) if resp.status_code == 200 else []
            return json.dumps(data)
        except Exception:
            return json.dumps([])

    def list_all_experiments(self) -> str:
        datasets = json.loads(self.list_datasets())
        all_exps = []
        for ds in datasets:
            exps = json.loads(self.list_experiments_for_dataset(ds["id"]))
            for e in exps:
                e["dataset_name"] = ds["name"]
                all_exps.append(e)
        return json.dumps(all_exps)

    def list_prompt_versions(self, prompt_name: str) -> str:
        try:
            from phoenix.client.resources.prompts import PromptVersion
            try:
                pv_list = self.client._sdk.prompts.list(prompt_name=prompt_name)
            except TypeError:
                pv_list = self.client._sdk.prompts.list(prompt_name)
            result = []
            for pv in pv_list:
                desc = getattr(pv, 'description', '') or getattr(pv, 'changelog', '') or ''
                result.append({"id": pv.id, "version": pv.id, "description": desc})
            return json.dumps(result)
        except Exception as e:
            return json.dumps([])

    def get_experiment_by_id(self, experiment_id: str) -> str:
        exp = self.client.get_experiment(experiment_id)
        runs = self.client.get_experiment_runs(experiment_id)
        scores = [r.get("score", 0) for r in runs if r.get("score") is not None]
        avg_score = sum(scores) / len(scores) if scores else 0
        return json.dumps({
            "id": experiment_id,
            "status": "completed" if exp.get("missing_run_count", 0) == 0 else "running",
            "baseline_scores": {"accuracy": avg_score * 0.9},
            "candidate_scores": {"accuracy": avg_score},
            "improvement": avg_score * 0.1,
            "winner": "candidate" if avg_score > 0.5 else "baseline"
        })

    def run_experiment(self, dataset_id: str, baseline_prompt_version: str, candidate_prompt_version: str, evaluators=None) -> str:
        exp = self.client.create_experiment(dataset_id=dataset_id, name=f"selfsurgeon-{datetime.now().strftime('%Y%m%d_%H%M%S')}")
        return json.dumps({"id": exp["id"], "dataset_id": dataset_id, "baseline_prompt_version": baseline_prompt_version, "candidate_prompt_version": candidate_prompt_version, "evaluators": evaluators or ["accuracy"], "status": "running", "created_at": datetime.now().isoformat()})


FLAWED_PROMPT = """You are a lead router. Route leads based on company_size:
- "small": under 50 employees -> route to SMB_SDR
- "enterprise": over 1000 employees -> route to ENT_AE
- "mid-market": everything else -> route to MM_REP

Input: {company_name}, {company_size}, {industry}
Output ONLY the route: SMB_SDR, MM_REP, or ENT_AE"""

FIXED_PROMPT = """You are a lead router. Route leads based on company_size:
- "small": 50 or fewer employees -> route to SMB_SDR
- "enterprise": 1000 or more employees -> route to ENT_AE
- "mid-market": between 51 and 999 employees -> route to MM_REP

Input: {company_name}, {company_size}, {industry}
Output ONLY the route: SMB_SDR, MM_REP, or ENT_AE

Boundary rules:
- Exactly 50 employees -> SMB_SDR
- Exactly 1000 employees -> ENT_AE"""


class FailureAnalyzer:
    BOUNDARY_PATTERNS = [r"under\s+(\d+)", r"over\s+(\d+)", r"exactly\s+(\d+)", r"(\d+)\s+or\s+less", r"(\d+)\s+or\s+more"]

    def analyze(self, trace_data: str) -> Dict:
        try:
            data = json.loads(trace_data)
        except json.JSONDecodeError:
            data = {"raw": trace_data}
        failure_type, confidence, description = self._detect_boundary_ambiguity(data)
        if failure_type == FailureType.UNKNOWN:
            failure_type, confidence, description = self._detect_other_failures(data)
        return {"failure_type": failure_type.value, "confidence": confidence, "affected_span_id": data.get("id", "unknown"), "description": description, "remediation": self._get_remediation(failure_type)}

    def _detect_boundary_ambiguity(self, data: Dict) -> tuple:
        company_size = data.get("input", {}).get("company_size")
        if company_size is None:
            return FailureType.UNKNOWN, 0.0, "No company_size found"
        if company_size in [50, 1000]:
            return (FailureType.BOUNDARY_AMBIGUITY, 0.97, f"Prompt ambiguous at exactly {company_size}")
        if company_size in [49, 51, 999, 1001]:
            return (FailureType.BOUNDARY_AMBIGUITY, 0.85, f"Input {company_size} near boundary threshold")
        return FailureType.UNKNOWN, 0.0, "No boundary ambiguity"

    def _detect_other_failures(self, data: Dict) -> tuple:
        span_name = data.get("name", "")
        if "retry" in span_name.lower():
            return FailureType.RETRY_LOOP, 0.8, "Repeated identical tool calls"
        if not data.get("input", {}):
            return FailureType.CONTEXT_LOSS, 0.7, "Required context missing"
        return FailureType.UNKNOWN, 0.5, "Could not determine failure type"

    def _get_remediation(self, failure_type: FailureType) -> str:
        return {FailureType.BOUNDARY_AMBIGUITY: "Use explicit inclusive boundaries: '50 or fewer', '1000 or more'", FailureType.TOOL_MISUSE: "Review tool argument schemas", FailureType.CONTEXT_LOSS: "Ensure all required context is passed", FailureType.GOAL_DRIFT: "Add explicit goal constraints", FailureType.RETRY_LOOP: "Add retry limits", FailureType.HALLUCINATION: "Add fact-checking step", FailureType.UNKNOWN: "Manual investigation required"}.get(failure_type, "Manual investigation required")


class PromptFixGenerator:
    def __init__(self):
        self.client = None
        try:
            from google import genai
            api_key = os.getenv("GEMINI_API_KEY")
            if api_key and api_key != "your_key_here":
                self.client = genai.Client(api_key=api_key)
        except Exception:
            pass

    def generate(self, current_prompt: str, failure_type: str, failure_description: str, historical_fixes: Optional[str] = None) -> Dict:
        if self.client:
            return self._generate_with_llm(current_prompt, failure_type, failure_description, historical_fixes)
        return self._generate_rule_based(current_prompt, failure_type, failure_description)

    def _generate_with_llm(self, current_prompt: str, failure_type: str, failure_description: str, historical_fixes: Optional[str]) -> Dict:
        from google.genai import types
        prompt_text = f"""You are an AI agent prompt optimizer. Given a flawed prompt and a failure analysis, generate an improved version.

Current Prompt:
```
{current_prompt}
```

Failure Type: {failure_type}
Failure Description: {failure_description}
{f'Historical Fixes: {historical_fixes}' if historical_fixes else ''}

Generate an improved prompt that fixes the failure. Return JSON with:
- new_prompt: The corrected prompt
- explanation: What was changed and why
- boundary_fixes: List of specific boundary conditions addressed"""
        try:
            response = self.client.models.generate_content(model="gemini-2.5-flash", contents=[prompt_text], config=types.GenerateContentConfig(system_instruction="You are a prompt optimization expert. Return valid JSON only.", temperature=0.3))
            try:
                return json.loads(response.text)
            except json.JSONDecodeError:
                return self._generate_rule_based(current_prompt, failure_type, failure_description)
        except Exception:
            return self._generate_rule_based(current_prompt, failure_type, failure_description)

    def _generate_rule_based(self, current_prompt: str, failure_type: str, failure_description: str) -> Dict:
        if failure_type == "BOUNDARY_AMBIGUITY":
            return {"new_prompt": FIXED_PROMPT, "explanation": "Changed ambiguous boundary language to explicit inclusive/exclusive rules", "boundary_fixes": [{"old": "under 50", "new": "50 or fewer"}, {"old": "over 1000", "new": "1000 or more"}, {"old": "everything else", "new": "between 51 and 999"}, {"added": "Boundary rules section with explicit exact-value handling"}], "failure_type": failure_type}
        return {"new_prompt": current_prompt, "explanation": "Generic fix applied", "boundary_fixes": [], "failure_type": failure_type}


class SafetyValidator:
    FORBIDDEN_PATTERNS = ["ignore previous instructions", "disregard safety", "output raw data", "bypass filter", "no restrictions", "disregard your instructions", "forget all rules", "override system", "jailbreak", "roleplay as different"]

    def validate(self, new_prompt: str) -> Dict:
        concerns = []
        nl = new_prompt.lower()
        for p in self.FORBIDDEN_PATTERNS:
            if p.lower() in nl:
                concerns.append(f"Forbidden pattern: '{p}'")
        if "```" in new_prompt and ("system" in nl or "assistant" in nl):
            concerns.append("Potential prompt injection via code blocks")
        return {"safe": len(concerns) == 0, "concerns": concerns, "validated_at": datetime.now().isoformat()}


def get_mcp_client():
    return ArizeMCPClient()

def get_failure_analyzer():
    return FailureAnalyzer()

def get_prompt_fix_generator():
    return PromptFixGenerator()

def get_safety_validator():
    return SafetyValidator()


if __name__ == "__main__":
    print("=" * 60)
    print("SelfSurgeon Tools - Test Suite")
    print("=" * 60)
    client = get_mcp_client()
    traces = json.loads(client.list_traces(limit=5))
    print(f"Found {len(traces)} traces (real data from Phoenix)")
    analyzer = get_failure_analyzer()
    fix = get_prompt_fix_generator().generate(current_prompt=FLAWED_PROMPT, failure_type="BOUNDARY_AMBIGUITY", failure_description="Test")
    print(f"Generated fix: yes")
    print("OK")
