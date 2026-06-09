"""
Step 5: DEPLOY - Update the in-memory prompt registry.
"""

from config import settings
from pathlib import Path

from models import DeployStatus, ExperimentResult, PromptFix

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

# Local prompt registry used by the SQLite-backed demo runtime.
PROMPT_REGISTRY = {
    "current_version": "flawed_v1",
    "current_content": (PROMPTS_DIR / "flawed_v1.txt").read_text(encoding="utf-8")
}

class Deployer:
    """Deploys winning prompt versions to the in-memory registry."""

    async def deploy(self, experiment: ExperimentResult, fix: PromptFix) -> DeployStatus:
        if experiment.improvement > settings.IMPROVEMENT_THRESHOLD:
            PROMPT_REGISTRY["current_version"] = experiment.new_version
            PROMPT_REGISTRY["current_content"] = fix.new_prompt
            print(f"  [DEPLOYED] +{experiment.improvement:.1%} improvement. Current version: {experiment.new_version}")
            return DeployStatus.DEPLOYED

        print(f"  [REJECTED] Only +{experiment.improvement:.1%} (need >{settings.IMPROVEMENT_THRESHOLD:.1%})")
        return DeployStatus.REJECTED

def get_current_prompt():
    return {
        "version": PROMPT_REGISTRY["current_version"],
        "template": PROMPT_REGISTRY["current_content"]
    }
