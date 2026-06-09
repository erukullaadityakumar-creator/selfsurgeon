# Devpost Submission: SelfSurgeon

## Project Title

**SelfSurgeon** - An autonomous self-healing loop for AI agents

## Problem Statement

AI agents often fail silently. A lead-routing agent can return a valid response while routing an edge-case lead incorrectly. There is no crash, no exception, and no obvious alert, just degraded behavior that can quietly affect revenue or operations.

The manual repair loop is slow: find bad traces, inspect the prompt, guess a fix, test a few cases, deploy, and hope the new prompt does not regress.

## Solution Overview

SelfSurgeon turns local observability records into corrective action. The current demo implements a closed-loop self-healing system that:

1. **Observes**: Reads execution traces from a local SQLite trace database and identifies records with low accuracy scores.
2. **Diagnoses**: Groups failures into root-cause categories such as boundary ambiguity, tool misuse, and output format violations.
3. **Prescribes**: Uses Gemini when configured, with deterministic fallback logic, to synthesize a targeted prompt repair.
4. **Validates**: Runs local baseline-vs-candidate checks against the failed trace cases.
5. **Deploys**: Promotes the repaired prompt into the local prompt registry when the improvement exceeds the safety threshold.
6. **Audits**: Records the surgery history for review in the dashboard.

## Tech Stack

- **Backend**: FastAPI
- **Frontend**: React 19, Vite, Tailwind CSS
- **Trace Store**: SQLite local trace database
- **Prompt Deployment**: Local prompt registry
- **LLM**: Gemini when configured, deterministic fallback when unavailable

## Key Challenges & Solutions

**Challenge: Detecting silent failures.**
SelfSurgeon stores each victim-agent run with the input, prediction, expected output, score, prompt version, and timestamp. The evaluation layer can then flag incorrect behavior even when the agent returns a normal response.

**Challenge: Repairing without regressions.**
The healer validates a candidate prompt against the failed trace set before deployment. A candidate must outperform the baseline by the configured threshold before it becomes the active prompt.

**Challenge: Keeping the demo reliable locally.**
The current implementation is SQLite-backed and local-first, so judges can run the end-to-end loop on Windows without requiring external observability services.

## Demo Flow

1. Generate failing traces.
2. Trigger SelfSurgeon.
3. Watch diagnosis, validation, prompt deployment, and surgery history update.
4. Generate traces again and confirm failures drop to zero.

## Historical Note

Earlier prototypes explored Arize Phoenix and MCP integrations. The current live demo is SQLite-backed and local trace-backed.
