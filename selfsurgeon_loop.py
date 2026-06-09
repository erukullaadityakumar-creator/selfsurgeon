"""
SelfSurgeon Loop — Autonomous Self-Healing Agent (Real Phoenix Integration)
"""

import os, json, asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum

from dotenv import load_dotenv
load_dotenv()

from tools import ArizeMCPClient, FailureAnalyzer, PromptFixGenerator, SafetyValidator, FLAWED_PROMPT, FIXED_PROMPT


class SurgeryStatus(Enum):
    HEALTHY = "healthy"
    OBSERVING = "observing"
    DIAGNOSING = "diagnosing"
    PRESCRIBING = "prescribing"
    VALIDATING = "validating"
    DEPLOYING = "deploying"
    AUDITING = "auditing"
    COMPLETED = "completed"
    ABORTED = "aborted"


@dataclass
class SurgeryRecord:
    timestamp: str
    failure_type: str
    affected_traces: List[str]
    diagnosis: Dict
    old_prompt_version: str
    new_prompt_version: str
    experiment_id: str
    baseline_accuracy: float
    candidate_accuracy: float
    improvement: float
    deploy_status: str
    safety_passed: bool

    def to_dict(self) -> Dict:
        return asdict(self)


class SelfSurgeon:
    def __init__(self, project_name="selfsurgeon-victim", surgery_dataset="surgery_log", failure_dataset="router_failures", prompt_name="router_system_prompt", deployment_threshold=0.05, max_deployments_per_hour=3):
        self.project_name = project_name
        self.surgery_dataset = surgery_dataset
        self.failure_dataset = failure_dataset
        self.prompt_name = prompt_name
        self.deployment_threshold = deployment_threshold
        self.max_deployments_per_hour = max_deployments_per_hour
        self.mcp = ArizeMCPClient()
        self.analyzer = FailureAnalyzer()
        self.generator = PromptFixGenerator()
        self.validator = SafetyValidator()
        self.surgery_history: List[SurgeryRecord] = []
        self.deployment_timestamps: List[datetime] = []
        self.current_status = SurgeryStatus.HEALTHY

    async def run_surgery_cycle(self) -> Dict:
        print(f"\n{'='*60}\nSELFSURGEON - Starting Surgery Cycle\n{'='*60}\n")

        # STEP 1: OBSERVE
        print("[1] OBSERVE: Scanning for failures...")
        self.current_status = SurgeryStatus.OBSERVING

        # Check router_failures dataset (populated by victim_agent.py)
        failures = []
        try:
            ds_json = self.mcp.get_dataset_examples("router_failures", limit=50)
            ds_examples = json.loads(ds_json)
            for ex in ds_examples:
                inp = ex.get("input", {})
                out = ex.get("output", {})
                meta = ex.get("metadata", {})
                if not meta.get("is_correct", True):
                    failures.append({"trace_id": meta.get("trace_id", "unknown"), "input": inp, "output": out.get("actual"), "expected": out.get("expected"), "company_size": inp.get("company_size")})
            print(f"    Found {len(failures)} failures in router_failures dataset")
        except Exception as e:
            print(f"    Dataset check: {e}")

        # Also check Phoenix traces
        traces_json = self.mcp.list_traces(project_name=self.project_name, limit=50)
        traces = json.loads(traces_json)
        print(f"    {len(traces)} traces in Phoenix project")

        if not failures:
            print("    No failures found. System healthy.")
            self.current_status = SurgeryStatus.HEALTHY
            return {"status": "healthy"}

        # STEP 2: DIAGNOSE
        print(f"[2] DIAGNOSE: Analyzing failures...")
        self.current_status = SurgeryStatus.DIAGNOSING
        clusters = {}
        for f in failures:
            analysis = self.analyzer.analyze(json.dumps(f))
            ft = analysis.get("failure_type", "UNKNOWN")
            clusters.setdefault(ft, []).append(f | {"diagnosis": analysis})

        if not clusters:
            print("    No actionable failures found.")
            self.current_status = SurgeryStatus.HEALTHY
            return {"status": "healthy"}

        top_failure = max(clusters.items(), key=lambda x: len(x[1]))
        failure_type, instances = top_failure
        print(f"    Top failure: {failure_type} ({len(instances)} instances)")

        # STEP 3: PRESCRIBE
        print("[3] PRESCRIBE: Generating fix...")
        self.current_status = SurgeryStatus.PRESCRIBING
        prompt_json = self.mcp.get_latest_prompt(self.prompt_name)
        prompt_data = json.loads(prompt_json)
        current_prompt = prompt_data.get("template", FLAWED_PROMPT)
        current_version = prompt_data.get("version", "v_unknown")
        print(f"    Current prompt version: {current_version}")

        fix = self.generator.generate(current_prompt=current_prompt, failure_type=failure_type, failure_description=json.dumps(instances[0]["diagnosis"]))
        new_prompt = fix.get("new_prompt", current_prompt)
        print(f"    Generated fix: {fix.get('explanation', 'No explanation')[:80]}...")

        safety = json.loads(self.validator.validate(new_prompt)) if isinstance(self.validator.validate(new_prompt), str) else self.validator.validate(new_prompt)
        if not safety.get("safe", False):
            print(f"    SAFETY FAILED: {safety.get('concerns', [])}")
            self.current_status = SurgeryStatus.ABORTED
            return {"status": "aborted", "reason": "safety"}

        print("    Safety check passed")

        # STEP 4: VALIDATE
        print("[4] VALIDATE: Running experiment...")
        self.current_status = SurgeryStatus.VALIDATING
        version_tag = f"v_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.mcp.upsert_prompt(prompt_name=self.prompt_name, version=version_tag, template=new_prompt, changelog=f"Fix {failure_type}: {fix.get('explanation', '')}")
        print(f"    Created candidate version: {version_tag}")

        examples = [{"input": i["input"], "output": {"route": self._ground_truth(i["input"]) if i.get("input") else ""}, "metadata": {"trace_id": i["trace_id"], "failure_type": failure_type}} for i in instances if i.get("input")]
        if examples:
            self.mcp.add_dataset_examples(dataset_id=self.failure_dataset, examples=examples)
            print(f"    Added {len(examples)} examples to dataset")

        exp_result = json.loads(self.mcp.run_experiment(dataset_id=self.failure_dataset, baseline_prompt_version=current_version, candidate_prompt_version=version_tag, evaluators=["accuracy"]))
        experiment_id = exp_result.get("id", "unknown")
        print(f"    Started experiment: {experiment_id}")
        await asyncio.sleep(2)
        exp_details = json.loads(self.mcp.get_experiment_by_id(experiment_id))
        baseline = exp_details.get("baseline_scores", {}).get("accuracy", 0.5)
        candidate = exp_details.get("candidate_scores", {}).get("accuracy", 0.5)
        improvement = candidate - baseline
        print(f"    Baseline: {baseline:.1%} | Candidate: {candidate:.1%} | Delta: {improvement:+.1%}")

        # STEP 5: DEPLOY
        print("[5] DEPLOY: Evaluating...")
        self.current_status = SurgeryStatus.DEPLOYING
        now = datetime.now()
        recent = [t for t in self.deployment_timestamps if (now - t).total_seconds() < 3600]
        can_deploy = improvement > self.deployment_threshold and len(recent) < self.max_deployments_per_hour

        if can_deploy:
            self.mcp.add_prompt_version_tag(prompt_name=self.prompt_name, version=version_tag, tag="production")
            deploy_status = "deployed"
            self.deployment_timestamps.append(now)
            print(f"    DEPLOYED: +{improvement:.1%} accuracy. Version {version_tag} is now production")
        else:
            deploy_status = "rejected"
            print(f"    REJECTED: +{improvement:.1%} (threshold: {self.deployment_threshold:.1%})" if improvement <= self.deployment_threshold else f"    REJECTED: Rate limit ({len(recent)}/hr)")

        # STEP 6: AUDIT
        print("[6] AUDIT: Logging surgery...")
        self.current_status = SurgeryStatus.AUDITING
        record = SurgeryRecord(timestamp=datetime.now().isoformat(), failure_type=failure_type, affected_traces=[i["trace_id"] for i in instances], diagnosis=instances[0]["diagnosis"], old_prompt_version=current_version, new_prompt_version=version_tag, experiment_id=experiment_id, baseline_accuracy=baseline, candidate_accuracy=candidate, improvement=improvement, deploy_status=deploy_status, safety_passed=True)
        self.surgery_history.append(record)
        self.mcp.ensure_dataset_exists(self.surgery_dataset, "SelfSurgeon surgery audit log")
        self.mcp.add_dataset_examples(dataset_id=self.surgery_dataset, examples=[{"input": record.to_dict(), "output": {"deploy_status": deploy_status}, "metadata": {"surgery_id": experiment_id}}])
        print(f"    Surgery logged to {self.surgery_dataset}")
        print(f"\n{'='*60}\nSURGERY COMPLETE: {deploy_status.upper()}\n{'='*60}")
        self.current_status = SurgeryStatus.COMPLETED
        return {"status": deploy_status, "failure_type": failure_type, "improvement": improvement, "new_version": version_tag if deploy_status == "deployed" else current_version, "baseline_accuracy": baseline, "candidate_accuracy": candidate}

    def _ground_truth(self, agent_input: Dict) -> str:
        cs = agent_input.get("company_size", 0) if isinstance(agent_input, dict) else 0
        if cs <= 50: return "SMB_SDR"
        elif cs >= 1000: return "ENT_AE"
        else: return "MM_REP"

    def get_status(self) -> Dict:
        return {"status": self.current_status.value, "surgeries_completed": len(self.surgery_history), "deployments_last_hour": len([t for t in self.deployment_timestamps if (datetime.now() - t).total_seconds() < 3600]), "last_surgery": self.surgery_history[-1].to_dict() if self.surgery_history else None}

    async def run_continuously(self, interval_seconds=300, healthy_interval_seconds=300):
        print(f"\n{'='*60}\nSELFSURGEON - Continuous Mode\n{'='*60}")
        print(f"Interval: {healthy_interval_seconds}s (healthy) / {interval_seconds}s (after surgery)")
        while True:
            try:
                result = await self.run_surgery_cycle()
                await asyncio.sleep(interval_seconds if result.get("status") != "healthy" else healthy_interval_seconds)
            except KeyboardInterrupt:
                print("\nStopped.")
                break
            except Exception as e:
                print(f"Error: {e}")
                await asyncio.sleep(60)


async def main():
    import argparse
    parser = argparse.ArgumentParser(description="SelfSurgeon")
    parser.add_argument("--continuous", "-c", action="store_true")
    parser.add_argument("--interval", "-i", type=int, default=300)
    parser.add_argument("--healthy-interval", type=int, default=300)
    args = parser.parse_args()
    print("SelfSurgeon - Autonomous Agent Observability & Self-Healing")
    print("Powered by Arize Phoenix + Gemini")
    surgeon = SelfSurgeon()
    if args.continuous:
        await surgeon.run_continuously(interval_seconds=args.interval, healthy_interval_seconds=args.healthy_interval)
    else:
        result = await surgeon.run_surgery_cycle()
        print(f"\nFinal Result:\n{json.dumps(result, indent=2)}")


if __name__ == "__main__":
    asyncio.run(main())

