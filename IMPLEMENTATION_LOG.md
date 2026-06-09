# SelfSurgeon V2 Implementation Log

> Historical note: this log documents an earlier Phoenix/MCP prototype pass. The current live Windows demo is SQLite-backed, uses a local trace database, and deploys prompts through the local prompt registry.

Date: 2026-05-25

## Summary (Updated 2026-05-26)

The build has transitioned from a mock demo to a Phoenix-backed autonomous agent.

**Recent Progress:**
- Wired the React frontend (`SurgeonContext.tsx`) to the FastAPI backend.
- Replaced simulation logic with real API calls for:
    - `triggerSelfHealing` $\rightarrow$ `/api/trigger`
    - `simulateFailure` $\rightarrow$ `/api/victim/simulate`
    - `addTraceToDataset` $\rightarrow$ `/api/dataset/add`
    - `rollbackPromptVersion` $\rightarrow$ `/api/prompts/rollback`
- Added missing backend endpoints in `routes.py` to support these actions.
- Verified Gemini API key configuration in `.env`.

**Remaining Implementation:**
- Full end-to-end cycle validation (Requires running Phoenix).
- Cloud Run and Vercel deployment (Artifacts prepared).
- Final documentation polish and Devpost submission.

The background agent can now:

1. Read failed route spans from Phoenix.
2. Diagnose boundary ambiguity failures.
3. Generate a corrected prompt.
4. Write a candidate prompt version to Phoenix.
5. Build a Phoenix failure dataset.
6. Run a real Phoenix experiment with baseline and candidate runs/evaluations.
7. Promote the candidate prompt version with the `production` tag when it wins.
8. Append a real surgery record to the Phoenix `surgery_log` dataset.
9. Skip already-handled failed traces so it does not repeatedly operate on the same failure batch.

The dashboard is now read-only. It displays live Phoenix data or `N/A`; it does not trigger healing.

## Files Changed

| File | Change |
| --- | --- |
| `tools.py` | Replaced simulated Phoenix responses with live Phoenix REST operations for spans, datasets, prompts, tags, experiments, and evaluations. |
| `victim_agent.py` | Added explicit Phoenix span creation for every route attempt. Boundary failures are deterministic. |
| `selfsurgeon_loop.py` | Uses real Phoenix prompt ids, tags deployed candidate versions, writes span ids into failure datasets, and skips already-handled traces. |
| `selfsurgeon_agent.py` | Added clear background-agent entry point for demos and deployment. |
| `dashboard.py` | Rebuilt as a live, read-only Phoenix viewer with no `SAMPLE_*` data. |
| `test_mcp.py` | Added strict official Phoenix MCP diagnostic using the Python `mcp` SDK and `@arizeai/phoenix-mcp`. |
| `requirements.txt` | Added `mcp`. |
| `tests/test_selfsurgeon.py` | Removed Windows-incompatible symbols and changed client test to verify Phoenix reachability instead of mock traces. |
| `BUILD_AUDIT.md` | Documents what was fake and what had to be rebuilt. |
| `SELFSURGEON_V2_SPEC.md` | Production-grade spec, contracts, phases, and demo script. |

## Live Phoenix Verification

Phoenix was reachable at:

```text
http://localhost:6006
```

### Victim Trace Generation

Command:

```bash
python victim_agent.py
```

Observed result:

```text
Total test cases: 51
Correct routes: 47
Incorrect routes: 4
Accuracy: 92.2%
Failure sizes: 50 and 1000
```

Each route attempt writes an explicit `router.route_lead` span to Phoenix with:

```json
{
  "selfsurgeon.kind": "victim_route",
  "selfsurgeon.accuracy": 0.0,
  "selfsurgeon.is_correct": false,
  "input.company_size": 50,
  "output.route": "MM_REP",
  "expected.route": "SMB_SDR",
  "prompt.name": "router_system_prompt",
  "prompt.version": "flawed"
}
```

### Full Agent Loop

Command:

```bash
python selfsurgeon_agent.py
```

First clean run after V2 wiring:

```text
[OBSERVE] Found 5 traces with potential failures
[DIAGNOSE] Top failure: BOUNDARY_AMBIGUITY (5 instances)
[PRESCRIBE] Generated fix
[VALIDATE] Started experiment: RXhwZXJpbWVudDoz
Baseline accuracy: 0.0%
Candidate accuracy: 100.0%
Improvement: +100.0%
[DEPLOY] Deployed candidate prompt version UHJvbXB0VmVyc2lvbjo0
[AUDIT] Surgery logged to surgery_log
```

Follow-up run:

```text
No failures detected. System healthy.
```

That follow-up confirms the agent does not repeatedly operate on already-audited failed traces.

## Real Phoenix Records Created

During verification, Phoenix accepted:

- Route spans in project `selfsurgeon-victim`.
- Prompt versions for `router_system_prompt`.
- Production prompt tags.
- Dataset uploads for `router_failures`.
- Experiment records and experiment run evaluations.
- Surgery audit records in `surgery_log`.

## Remaining External Blockers

### Official MCP runtime

`test_mcp.py` uses the Python `mcp` SDK and starts the official Phoenix MCP server:

```bash
npx -y @arizeai/phoenix-mcp@latest --baseUrl http://localhost:6006
```

Current machine status:

```text
node exists through the Codex app bundle
npx is not on PATH
```

Result:

```text
FAIL: Node.js and npx are required for @arizeai/phoenix-mcp.
```

This is intentionally not bypassed. Install Node.js or put `npx` on PATH, then run:

```bash
python test_mcp.py
```

### Gemini key

`.env` still contains:

```text
GEMINI_API_KEY=your_key_here
```

Because of that, prompt fixing uses the deterministic rule-based fallback. The Gemini code path is present in `PromptFixGenerator`, but it cannot be verified until a real key is configured.

### Cloud Run

Cloud Run deployment was not performed because this workspace does not contain authenticated Google Cloud credentials or a target project id.

## Demo Commands

Run Phoenix first:

```bash
docker-compose up -d phoenix
```

Generate real failed traces:

```bash
python victim_agent.py
```

Run one autonomous surgery:

```bash
python selfsurgeon_agent.py
```

Run continuously:

```bash
python selfsurgeon_agent.py --continuous
```

Open dashboard:

```bash
streamlit run dashboard.py
```

Run tests:

```bash
python tests/test_selfsurgeon.py
```

Run MCP diagnostic after installing `npx`:

```bash
python test_mcp.py
```
