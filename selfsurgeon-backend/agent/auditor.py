"""
Step 6: AUDIT - Log every surgery to a local store.
"""

from datetime import datetime
from typing import List

from models import DeployStatus, ExperimentResult, FailureDiagnosis, PromptFix, SurgeryRecord

class Auditor:
    """Maintains surgery audit trail in a simple list (simulating a dataset)."""

    def __init__(self):
        self.history: List[SurgeryRecord] = []

    async def audit(self, diagnosis: FailureDiagnosis, fix: PromptFix, experiment: ExperimentResult, deploy_status: DeployStatus) -> SurgeryRecord:
        record = SurgeryRecord(
            surgery_id=f"surg_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            timestamp=datetime.now(),
            failure_type=diagnosis.failure_type,
            affected_traces=diagnosis.affected_traces,
            affected_count=len(diagnosis.trace_details),
            diagnosis_confidence=diagnosis.confidence,
            old_prompt_version=experiment.old_version,
            new_prompt_version=experiment.new_version,
            experiment_id=experiment.experiment_id,
            baseline_accuracy=experiment.baseline_accuracy,
            candidate_accuracy=experiment.candidate_accuracy,
            improvement=experiment.improvement,
            deploy_status=deploy_status,
            fix_explanation=fix.explanation,
            fix_boundary_changes=fix.boundary_fixes,
            old_prompt=fix.old_prompt,
            new_prompt=fix.new_prompt,
            diagnosis_details=diagnosis.description,
            experiment_results=[
                {"test_case": f"Exp_Target_{diagnosis.failure_type.value}", "baseline": experiment.baseline_accuracy, "candidate": experiment.candidate_accuracy},
            ],
        )

        self.history.append(record)
        print(f"  [AUDIT] Surgery logged: {record.surgery_id}")
        return record

    def get_history(self, limit: int = 50) -> list[dict]:
        return [r.model_dump(mode="json") for r in self.history[-limit:]]
