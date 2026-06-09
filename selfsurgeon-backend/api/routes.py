"""
FastAPI REST endpoints for frontend consumption.
"""

from fastapi import APIRouter

from agent.selfsurgeon import SelfSurgeon
from config import settings
from mcp_client.tools import arize_tools
from models import APIResponse
from services.phoenix_service import phoenix_service
from victim.router_agent import generate_failure_traces


router = APIRouter()
surgeon = SelfSurgeon()


@router.get("/api/health", response_model=APIResponse)
async def health_check():
    health = await surgeon.get_health()
    return APIResponse(success=True, data=health.model_dump(mode="json"))


@router.get("/api/surgeries", response_model=APIResponse)
async def get_surgeries(limit: int = 50):
    surgeries = await surgeon.get_surgeries(limit)
    return APIResponse(success=True, data={"surgeries": surgeries})


@router.get("/api/traces", response_model=APIResponse)
async def get_traces(failed_only: bool = True, limit: int = 50):
    traces = await phoenix_service.list_traces(settings.PROJECT_NAME, limit=limit, failed_only=failed_only)
    return APIResponse(success=True, data=traces)


@router.get("/api/prompts/current", response_model=APIResponse)
async def get_current_prompt():
    from agent.deployer import get_current_prompt
    prompt = get_current_prompt()
    return APIResponse(success=True, data={"version": prompt.get("version", "unknown"), "template": prompt.get("template", "")})


@router.post("/api/prompts/rollback", response_model=APIResponse)
async def rollback_prompt(version: str):
    try:
        result = await arize_tools.add_prompt_version_tag(settings.PROMPT_REGISTRY_NAME, version, "production")
        return APIResponse(success=True, data=result)
    except Exception as exc:
        return APIResponse(success=False, error=str(exc))


@router.post("/api/trigger", response_model=APIResponse)
async def trigger_surgery():
    try:
        result = await surgeon.run_cycle()
        return APIResponse(success=True, data=result)
    except Exception as exc:
        return APIResponse(success=False, error=str(exc))


@router.post("/api/dataset/add", response_model=APIResponse)
async def add_to_dataset(trace_id: str):
    try:
        # Get the span for the trace to get the content
        spans = await phoenix_service.get_spans(settings.PROJECT_NAME, trace_id=trace_id)
        if not spans["spans"]:
            return APIResponse(success=False, error=f"Trace {trace_id} not found")

        span = spans["spans"][0]
        example = {
            "input": span["input"],
            "expected_output": span["expected"],
            "metadata": {"trace_id": trace_id, "verified": True},
            "span_id": span["span_id"]
        }

        await phoenix_service.add_dataset_examples(settings.SURGERY_DATASET, [example])
        return APIResponse(success=True, data={"message": f"Trace {trace_id} added to surgery log"})
    except Exception as exc:
        return APIResponse(success=False, error=str(exc))


@router.post("/api/victim/generate", response_model=APIResponse)
async def generate_victim_traces(count: int = 50, failure_type: str = "BOUNDARY_AMBIGUITY"):
    try:
        results = await generate_failure_traces(count, failure_type)
        failures = [r for r in results if r["score"] < settings.FAILURE_THRESHOLD]
        return APIResponse(success=True, data={"generated": len(results), "failures": len(failures), "failure_type": failure_type})
    except Exception as exc:
        return APIResponse(success=False, error=str(exc))


@router.post("/api/victim/simulate", response_model=APIResponse)
async def simulate_failure(company_size: int = 50, failure_type: str = "BOUNDARY_AMBIGUITY"):
    try:
        from victim.router_agent import route_lead
        industry = "simulation"
        if failure_type.upper() == "OUTPUT_FORMAT_VIOLATION":
            industry = "format-compliance"
        elif failure_type.upper() == "TOOL_MISUSE":
            industry = "tool-enrichment"
            company_size = 0
        res = await route_lead("SIMULATED_FAILURE", company_size, industry, failure_type)
        return APIResponse(success=True, data=res)
    except Exception as exc:
        return APIResponse(success=False, error=str(exc))
