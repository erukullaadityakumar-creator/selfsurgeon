"""
Main agent loop: orchestrates all 6 steps.
"""

from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Optional

from config import settings
from mcp_client.tools import arize_tools
from models import SystemHealth
from services.phoenix_service import phoenix_service

from .auditor import Auditor
from .deployer import Deployer
from .diagnostician import Diagnostician
from .observer import Observer
from .surgeon import Surgeon
from .validator import Validator


class SelfSurgeon:
    """Autonomous self-healing agent."""

    def __init__(self):
        self.observer = Observer()
        self.diagnostician = Diagnostician()
        self.surgeon = Surgeon()
        self.validator = Validator()
        self.deployer = Deployer()
        self.auditor = Auditor()
        self.surgery_count = 0
        self.total_improvement = 0.0
        self.last_surgery: Optional[datetime] = None

    async def run_cycle(self) -> dict:
        print(f"\n{'=' * 60}")
        print(f"SELFSURGEON CYCLE #{self.surgery_count + 1} | {datetime.now()}")
        print(f"{'=' * 60}")

        traces = await self.observer.observe()
        handled = await self._handled_trace_ids()
        traces = [span for span in traces if span.trace_id not in handled]
        if not traces:
            return {"status": "healthy", "message": "No failures detected"}

        diagnosis = await self.diagnostician.diagnose(traces)
        if not diagnosis:
            return {"status": "no_diagnosis", "message": "Could not classify"}

        fix = await self.surgeon.prescribe(diagnosis)
        if not fix:
            return {"status": "fix_failed", "message": "Safety check failed"}

        experiment = await self.validator.validate(fix, diagnosis)
        deploy_status = await self.deployer.deploy(experiment, fix)
        record = await self.auditor.audit(diagnosis, fix, experiment, deploy_status)

        self.surgery_count += 1
        self.total_improvement += experiment.improvement
        self.last_surgery = datetime.now()

        return {
            "status": deploy_status.value,
            "failure_type": diagnosis.failure_type.value,
            "improvement": experiment.improvement,
            "new_version": experiment.new_version,
            "affected_traces": len(diagnosis.trace_details),
            "surgery_id": record.surgery_id,
        }

    async def run_continuous(self):
        while True:
            result = await self.run_cycle()
            await asyncio.sleep(settings.SURGERY_INTERVAL_MINUTES * 60 if result["status"] == "healthy" else 60)

    async def get_health(self) -> SystemHealth:
        # Local-first health check
        phoenix_connected = False # Assume offline for the autonomous local mode
        surgeries = await self.get_surgeries()

        # Get current version from the in-memory registry
        from agent.deployer import get_current_prompt
        prompt = get_current_prompt()

        last = None
        total_gain = 0.0
        if surgeries:
            last = max((self._parse_dt(s.get("timestamp")) for s in surgeries if s.get("timestamp")), default=None)
            total_gain = sum(float(s.get("improvement", 0) or 0) for s in surgeries if s.get("deploy_status") == "DEPLOYED")
        return SystemHealth(
            status="HEALTHY",
            phoenix_connected=phoenix_connected,
            last_surgery=last,
            surgeries_completed=len(surgeries),
            total_accuracy_gain=total_gain,
            current_prompt_version=prompt.get("version", "unknown"),
        )

    async def get_surgeries(self, limit: int = 50) -> list[dict]:
        # Read from local auditor instead of Phoenix
        return self.auditor.get_history(limit)

    async def _handled_trace_ids(self) -> set[str]:
        handled: set[str] = set()
        # Read from local auditor history instead of Phoenix
        for record in self.auditor.history:
            # SurgeryRecord usually has affected_traces as a list of IDs
            if hasattr(record, 'affected_traces') and isinstance(record.affected_traces, list):
                handled.update(record.affected_traces)
            elif isinstance(record, dict) and 'affected_traces' in record:
                handled.update(record['affected_traces'])
        return handled

    def _parse_dt(self, value: str | None) -> Optional[datetime]:
        if not value:
            return None
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None
