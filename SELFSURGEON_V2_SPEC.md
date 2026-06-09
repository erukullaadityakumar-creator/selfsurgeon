# SelfSurgeon V2 Production Build Spec

> Historical note: this spec describes the original Phoenix/MCP architecture direction. The current live Windows demo is SQLite-backed and local trace-backed.

## North Star

SelfSurgeon is not a dashboard. SelfSurgeon is an autonomous background agent that turns Phoenix observability into corrective action.

The dashboard must not trigger the healing loop. It only displays what the agent already observed, diagnosed, validated, deployed, and logged.

## Required Components

| Component | Responsibility |
| --- | --- |
| Victim agent | Generates real lead-routing traces in Phoenix. |
| Phoenix MCP/SDK adapter | Reads traces/spans and writes prompts, datasets, experiments, and audit records. |
| Failure observer | Finds traces/spans with accuracy below threshold. |
| Failure diagnoser | Clusters failures and identifies the most common root cause. |
| Prompt surgeon | Generates candidate prompt fixes with Gemini. |
| Safety gate | Blocks unsafe or malformed candidate prompts. |
| Experiment runner | Runs baseline-vs-candidate validation on Phoenix failure dataset. |
| Deployment gate | Promotes candidate only when improvement exceeds threshold. |
| Audit logger | Appends every decision to `surgery_log`. |
| Dashboard | Read-only viewer over Phoenix records. |

## Environment

Required:

```text
GEMINI_API_KEY=...
ARIZE_PHOENIX_HOST=http://localhost:6006
PHOENIX_PROJECT_NAME=selfsurgeon-victim
SURGERY_INTERVAL_SECONDS=300
DEPLOYMENT_THRESHOLD=0.05
```

Optional for protected/cloud Phoenix:

```text
ARIZE_API_KEY=...
```

## Phoenix MCP

Use the official Phoenix MCP server through `npx`:

```bash
npx -y @arizeai/phoenix-mcp@latest --baseUrl http://localhost:6006
```

For cloud or authenticated Phoenix:

```bash
npx -y @arizeai/phoenix-mcp@latest --baseUrl https://my-phoenix.example.com --apiKey $ARIZE_API_KEY
```

The first diagnostic is:

```bash
python test_mcp.py
```

If this cannot list useful Phoenix tools, stop. The rest of the system will only be another mock demo.

## Trace Contract

Each victim agent route attempt must produce a trace/span with:

```json
{
  "project_name": "selfsurgeon-victim",
  "span_name": "router.route_lead",
  "input": {
    "company_name": "BoundaryTest1",
    "company_size": 50,
    "industry": "saas"
  },
  "output": "MM_REP",
  "expected": "SMB_SDR",
  "is_correct": false,
  "accuracy": 0.0,
  "prompt_name": "router_system_prompt",
  "prompt_version": "v_flawed"
}
```

Required failure condition:

```text
accuracy < 0.8 OR is_correct == false
```

## Surgery Record Contract

Every cycle writes one append-only record to `surgery_log`:

```json
{
  "timestamp": "2026-05-25T00:00:00Z",
  "project_name": "selfsurgeon-victim",
  "failure_type": "BOUNDARY_AMBIGUITY",
  "affected_trace_ids": ["..."],
  "affected_span_ids": ["..."],
  "diagnosis": {
    "root_cause": "Boundary values are not specified as inclusive or exclusive.",
    "confidence": 0.97
  },
  "old_prompt": {
    "name": "router_system_prompt",
    "version": "v_flawed"
  },
  "candidate_prompt": {
    "name": "router_system_prompt",
    "version": "v_20260525_000000"
  },
  "experiment": {
    "id": "...",
    "baseline_accuracy": 0.625,
    "candidate_accuracy": 0.941,
    "improvement": 0.316
  },
  "deployment": {
    "threshold": 0.05,
    "status": "deployed",
    "tag": "production"
  },
  "safety": {
    "passed": true,
    "concerns": []
  }
}
```

## Implementation Phases

### Phase 0: Prove Phoenix Access

1. Run Phoenix locally or connect to cloud Phoenix.
2. Run `python test_mcp.py`.
3. Confirm MCP exposes useful tools for traces/spans, datasets, prompts, and experiments.

### Phase 1: Real Traces

1. Add explicit OpenTelemetry spans around `RouterBot.route_lead`.
2. Attach input/output/expected/accuracy attributes.
3. Run 50 test cases.
4. Verify failed traces in Phoenix UI.

### Phase 2: Real Agent Loop

1. Replace mock `ArizeMCPClient`.
2. Implement observe from Phoenix traces/spans.
3. Implement diagnose from live span data.
4. Implement prescribe with Gemini plus safety gate.
5. Implement validate through real Phoenix experiment.
6. Implement deploy through prompt tag update.
7. Implement audit through `surgery_log`.

### Phase 3: Read-Only Dashboard

1. Delete all `SAMPLE_*` data.
2. Load surgeries from `surgery_log`.
3. Load current production prompt from Phoenix.
4. Load experiment results from Phoenix.
5. Remove manual `Analyze Trace` as a healing trigger.

### Phase 4: Demo Hardening

1. Add integration tests.
2. Add reproducible demo commands.
3. Deploy worker and dashboard separately.
4. Record the demo from real terminal and Phoenix UI output.

## Demo Script

### 0:00-0:15 - Silent Failure

Show the victim agent routing boundary cases incorrectly while returning normal outputs.

```text
BoundaryTest1(50) -> MM_REP expected SMB_SDR FAIL
```

### 0:15-0:45 - SelfSurgeon Observes

Show the background worker.

```text
[OBSERVE] Scanning Phoenix for failed traces...
Found 8 traces with accuracy < 0.8
[DIAGNOSE] BOUNDARY_AMBIGUITY, confidence 0.97
```

### 0:45-1:30 - SelfSurgeon Validates

Show real experiment creation and result.

```text
[PRESCRIBE] Candidate prompt v_...
[VALIDATE] Phoenix experiment ...
Experiment complete: 62.5% -> 94.1% (+31.6%)
```

### 1:30-2:15 - SelfSurgeon Deploys

Show prompt version tagged as production and `surgery_log` updated.

```text
[DEPLOY] Candidate exceeded threshold by +31.6%
[AUDIT] Logged surgery to Phoenix dataset surgery_log
```

### 2:15-3:00 - Proof

Show dashboard reading real Phoenix data: surgery record, current production prompt, experiment delta, affected traces.

## Non-Negotiables

- No hardcoded dashboard metrics.
- No simulated Phoenix traces.
- No fake experiment scores.
- No deployment without validation.
- No UI-triggered healing path.
- No claim in README unless the code path is live.
