"""
Step 4: VALIDATE - Run local validation of old vs new prompt.
"""

from datetime import datetime
from config import settings
from models import ExperimentResult, FailureDiagnosis, FailureType, PromptFix

class Validator:
    """Runs local experiments to validate fixes using internal logic."""

    async def validate(self, fix: PromptFix, diagnosis: FailureDiagnosis) -> ExperimentResult:
        print("[VALIDATE] Running local validation experiment...")

        from agent.deployer import get_current_prompt
        from victim.router_agent import flawed_route, ground_truth, json_expected_route, smart_route_for_failure

        failure_type = diagnosis.failure_type.value
        current_prompt = get_current_prompt()

        baseline_correct = 0
        for span in diagnosis.trace_details:
            size = span.input.company_size
            if diagnosis.failure_type == FailureType.OUTPUT_FORMAT_VIOLATION:
                baseline_prediction = ground_truth(size)
                expected = json_expected_route(size)
            elif diagnosis.failure_type == FailureType.TOOL_MISUSE:
                baseline_prediction = flawed_route(size)
                expected = "CRM_LOOKUP" if size <= 0 else ground_truth(size)
            else:
                baseline_prediction = flawed_route(size)
                expected = ground_truth(size)
            if baseline_prediction == expected:
                baseline_correct += 1
        baseline_acc = baseline_correct / len(diagnosis.trace_details) if diagnosis.trace_details else 0

        candidate_correct = 0
        for span in diagnosis.trace_details:
            candidate_prediction, expected = smart_route_for_failure(
                span.input.company_size,
                fix.new_prompt,
                failure_type,
            )
            if candidate_prediction == expected:
                candidate_correct += 1
        candidate_acc = candidate_correct / len(diagnosis.trace_details) if diagnosis.trace_details else 0

        improvement = candidate_acc - baseline_acc
        print(f"  Experiment: {baseline_acc:.1%} -> {candidate_acc:.1%} (delta {improvement:+.1%})")

        return ExperimentResult(
            experiment_id=f"exp_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            baseline_accuracy=baseline_acc,
            candidate_accuracy=candidate_acc,
            improvement=improvement,
            old_version=current_prompt.get("version", "unknown"),
            new_version=f"v_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
        )
