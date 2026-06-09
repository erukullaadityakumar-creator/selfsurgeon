import os

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("GEMINI_API_KEY", "")
os.environ.setdefault("MCP_ENABLED", "false")

from agent.diagnostician import Diagnostician
from main import app
from models import FailureType, TraceInput, TraceSpan
from victim.router_agent import flawed_route, ground_truth


def test_ground_truth_boundaries():
    assert ground_truth(50) == "SMB_SDR"
    assert ground_truth(51) == "MM_REP"
    assert ground_truth(999) == "MM_REP"
    assert ground_truth(1000) == "ENT_AE"


def test_flawed_router_fails_boundaries():
    assert flawed_route(50) == "MM_REP"
    assert flawed_route(1000) == "MM_REP"


@pytest.mark.asyncio
async def test_diagnostician_detects_boundary_ambiguity():
    span = TraceSpan(
        span_id="s1",
        trace_id="t1",
        name="router.route_lead",
        input=TraceInput(company_name="Boundary", company_size=50, industry="saas"),
        output="MM_REP",
        expected="SMB_SDR",
        score=0.0,
        attributes={},
    )
    diagnosis = await Diagnostician().diagnose([span])
    assert diagnosis.failure_type == FailureType.BOUNDARY_AMBIGUITY
    assert diagnosis.confidence > 0.9


def test_api_root():
    client = TestClient(app)
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["name"] == "SelfSurgeon API"
