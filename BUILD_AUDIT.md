# SelfSurgeon Build Audit

> Historical note: this audit reflects an earlier Phoenix/MCP prototype. The current live Windows demo is SQLite-backed, uses local trace analysis, and deploys repaired prompts through the local prompt registry.

Date: 2026-05-25

## Verdict

This repository originally demonstrated the shape of SelfSurgeon, but it was not the product described in the README. The V2 pass replaced the core mock path with live Phoenix operations for spans, datasets, prompts, experiments, deployment tags, and surgery logging.

See `IMPLEMENTATION_LOG.md` for the completed implementation and verification trail.

The winning version must make the background agent the product. The dashboard should only display facts already produced by the agent.

## What Is Actually Wrong

| Problem | Evidence in repo | Why it matters |
| --- | --- | --- |
| Fake Phoenix/MCP data | Fixed for runtime: `tools.py` now uses live Phoenix REST resources. `test_mcp.py` remains the official MCP diagnostic. | Runtime no longer depends on `_simulate_*` Phoenix data. |
| Dashboard is sample-driven | Fixed: `dashboard.py` no longer contains `SAMPLE_*` constants. | Metrics now come from Phoenix or show `N/A`. |
| No real MCP diagnostic | Fixed: `test_mcp.py` exists. | It currently fails until `npx` is installed/on PATH. |
| Experiment validation is simulated | Fixed: experiments are created in Phoenix with baseline/candidate runs and CODE accuracy evaluations. | The loop now reads experiment JSON and computes real scores. |
| Prompt deployment is simulated | Fixed: candidate prompt versions are written to Phoenix and tagged `production`. | Deployment is persisted in Phoenix prompt registry. |
| Audit log is simulated | Fixed: surgery records append to Phoenix `surgery_log`. | Dashboard reads these records. |
| Victim traces may not be real | Fixed: every route attempt creates an explicit Phoenix span. | Failed spans include input, output, expected route, and accuracy attributes. |
| Tests validate mocks | Improved: tests now verify Phoenix reachability and local logic. | More integration coverage can still be added. |
| README overclaims current state | Partially fixed by this audit/spec/log. | README can still be rewritten to match V2 exactly. |

## Current File Reality

### `tools.py`

Current role: live Phoenix runtime adapter plus local analysis utilities.

Real parts:
- `FailureAnalyzer` can classify boundary-size failures from span-like JSON.
- `PromptFixGenerator` can call Gemini if `GEMINI_API_KEY` is set, with a rule-based fallback.
- `SafetyValidator` checks candidate prompts for forbidden text patterns.

Live Phoenix parts:
- `ArizeMCPClient.list_traces()`
- `ArizeMCPClient.get_trace()`
- `ArizeMCPClient.get_spans()`
- `ArizeMCPClient.get_span()`
- `ArizeMCPClient.get_span_annotations()`
- `ArizeMCPClient.list_datasets()`
- `ArizeMCPClient.get_dataset()`
- `ArizeMCPClient.get_dataset_examples()`
- `ArizeMCPClient.add_dataset_examples()`
- `ArizeMCPClient.upsert_prompt()`
- `ArizeMCPClient.get_latest_prompt()`
- `ArizeMCPClient.add_prompt_version_tag()`
- `ArizeMCPClient.list_experiments_for_dataset()`
- `ArizeMCPClient.get_experiment_by_id()`
- `ArizeMCPClient.run_experiment()`

Remaining note: `test_mcp.py` is the official Phoenix MCP diagnostic and still requires `npx`.

### `selfsurgeon_loop.py`

Current role: an autonomous live Phoenix-backed healing loop.

What it does:
- Runs observe, diagnose, prescribe, validate, deploy, and audit without UI clicks.
- Clusters failures by failure type.
- Applies a deployment threshold and simple rate limit.

What is live:
- Failed traces are read from Phoenix spans.
- Candidate prompts are written to Phoenix.
- Experiments are created in Phoenix with baseline/candidate run evaluations.
- Winning prompt versions are tagged `production`.
- Surgery records are appended to `surgery_log`.
- Already-handled traces are skipped on later runs.

### `dashboard.py`

Current role: read-only Streamlit viewer over live Phoenix state.

What is live:
- Surgery history is read from `surgery_log`.
- Failed traces are read from Phoenix route spans.
- Production prompt is read from Phoenix prompt registry.
- Empty/missing data displays as `N/A` or an empty state.
- There is no manual healing button.

### `victim_agent.py`

Current role: deterministic lead-router demonstration with optional Gemini call.

What works:
- Generates boundary-heavy test cases.
- Computes ground truth locally.
- Writes `data/router_results.json`.
- Writes explicit `router.route_lead` spans to Phoenix.

Risks:
- Gemini is not exercised until `GEMINI_API_KEY` is configured.
- Optional auto-instrumentation is not installed, but explicit REST spans are written.

### `tests/test_selfsurgeon.py`

Current role: unit tests for Phoenix reachability and local logic.

Remaining improvement: split tests into:
- Fast unit tests for analyzer/generator/validator.
- Integration tests for Phoenix health, MCP tool listing, trace retrieval, dataset writes, prompt writes, experiment runs, and surgery logging.

## Product Definition

SelfSurgeon is a background agent process that:

1. Runs continuously or on a schedule.
2. Reads real traces from Arize Phoenix through MCP or official Phoenix APIs.
3. Detects real failures using trace/span annotations and scores.
4. Clusters failures by root cause.
5. Generates a prompt fix with Gemini.
6. Writes a candidate prompt version.
7. Runs a real Phoenix experiment on a curated failure dataset.
8. Deploys only if candidate improvement exceeds the configured threshold.
9. Logs every step to a real `surgery_log` dataset.

The Streamlit app is only a read-only viewer over these facts.

## Target Runtime Loop

```text
Every 5 minutes:
  OBSERVE
    Query Phoenix for traces/spans with accuracy < 0.8.

  DIAGNOSE
    Cluster failures by type.
    Pick the most frequent actionable cluster.
    Identify the failing span and relevant prompt version.

  PRESCRIBE
    Generate a corrected prompt using Gemini.
    Run safety validation.
    Write candidate prompt version to Phoenix.

  VALIDATE
    Build or update a failure dataset from failed traces.
    Run Phoenix experiment: baseline prompt vs candidate prompt.
    Wait for experiment completion.
    Extract baseline score, candidate score, and delta.

  DEPLOY
    If delta > DEPLOYMENT_THRESHOLD and safety passed, tag candidate as production.
    Otherwise reject and keep current production prompt.

  AUDIT
    Append a complete surgery record to Phoenix surgery_log dataset.
```

## Must-Fix List

| Priority | Task | Done when |
| --- | --- | --- |
| P0 | Add and run `test_mcp.py` | It lists real Phoenix MCP tools and confirms trace/span access exists. |
| P0 | Replace mock `ArizeMCPClient` | No `list_traces`, `run_experiment`, or dataset/prompt method returns simulated JSON. |
| P0 | Generate useful real traces | Phoenix UI shows `selfsurgeon-victim` traces with route inputs, outputs, expected route, and accuracy. |
| P1 | Add real experiment validation | Phoenix contains a completed baseline-vs-candidate experiment. |
| P1 | Add real surgery audit logging | Phoenix contains append-only `surgery_log` records for each cycle. |
| P1 | Remove dashboard samples | Dashboard metrics come from Phoenix or show `N/A`. |
| P2 | Make victim trace attributes explicit | Failed traces can be diagnosed without guessing from local files. |
| P2 | Add integration tests | CI/local tests fail when Phoenix/MCP integration is not live. |
| P3 | Deploy background agent separately from UI | Agent runs as worker/cron; dashboard runs as viewer. |
| P3 | Cloud Run deployment | Public demo URL shows real logged surgeries. |

## Demo Acceptance Criteria

The demo is real only if all of these are true:

1. `python test_mcp.py` proves Phoenix MCP is reachable.
2. `python victim_agent.py` creates visible Phoenix traces.
3. `python selfsurgeon_loop.py` reads those traces from Phoenix, not from mocks.
4. Phoenix contains a real failure dataset.
5. Phoenix contains a real experiment comparing old and new prompt behavior.
6. Phoenix prompt registry has a candidate version and production tag.
7. Phoenix contains a `surgery_log` entry.
8. Dashboard numbers match Phoenix records.

## References

- Phoenix MCP server docs: https://arize.com/docs/phoenix/integrations/frameworks/model-context-protocol/phoenix-mcp-server
- Phoenix coding agents docs: https://arize.com/docs/phoenix/integrations/developer-tools/coding-agents
