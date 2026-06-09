"""
Pydantic models for data validation and API responses.
"""

from datetime import datetime
from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field


class FailureType(str, Enum):
    BOUNDARY_AMBIGUITY = "BOUNDARY_AMBIGUITY"
    OUTPUT_FORMAT_VIOLATION = "OUTPUT_FORMAT_VIOLATION"
    TOOL_MISUSE = "TOOL_MISUSE"
    CONTEXT_LOSS = "CONTEXT_LOSS"
    GOAL_DRIFT = "GOAL_DRIFT"
    RETRY_LOOP = "RETRY_LOOP"
    HALLUCINATION = "HALLUCINATION"
    UNKNOWN = "UNKNOWN"


class DeployStatus(str, Enum):
    DEPLOYED = "DEPLOYED"
    REJECTED = "REJECTED"
    PENDING = "PENDING"


class TraceInput(BaseModel):
    company_name: str
    company_size: int
    industry: str


class TraceSpan(BaseModel):
    span_id: str
    trace_id: str
    name: str
    input: TraceInput
    output: str
    expected: str
    score: float
    attributes: dict = Field(default_factory=dict)


class FailureDiagnosis(BaseModel):
    failure_type: FailureType
    confidence: float = Field(ge=0.0, le=1.0)
    description: str
    affected_traces: list[str]
    trace_details: list[TraceSpan]


class PromptFix(BaseModel):
    new_prompt: str
    explanation: str
    boundary_fixes: list[str]
    old_prompt: str


class ExperimentResult(BaseModel):
    experiment_id: str
    baseline_accuracy: float
    candidate_accuracy: float
    improvement: float
    old_version: str
    new_version: str


class SurgeryRecord(BaseModel):
    surgery_id: str
    timestamp: datetime
    failure_type: FailureType
    affected_traces: list[str] = Field(default_factory=list)
    affected_count: int
    diagnosis_confidence: float
    old_prompt_version: str
    new_prompt_version: str
    experiment_id: str
    baseline_accuracy: float
    candidate_accuracy: float
    improvement: float
    deploy_status: DeployStatus
    fix_explanation: str
    fix_boundary_changes: list[str]
    old_prompt: str = ""
    new_prompt: str = ""
    diagnosis_details: str = ""
    experiment_results: list[dict] = Field(default_factory=list)



class SystemHealth(BaseModel):
    status: Literal["HEALTHY", "DEGRADED", "CRITICAL", "UNKNOWN"]
    phoenix_connected: bool
    last_surgery: Optional[datetime]
    surgeries_completed: int
    total_accuracy_gain: float
    current_prompt_version: str


class APIResponse(BaseModel):
    success: bool
    data: Optional[dict | list] = None
    error: Optional[str] = None
