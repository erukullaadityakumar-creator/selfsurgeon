# SelfSurgeon

SelfSurgeon is a local self-healing agent demo. It generates failing lead-routing traces, detects failure patterns from a SQLite trace store, diagnoses the root cause, writes a repaired prompt into a local prompt registry, validates the repair, deploys the winning prompt, and shows the recovery in a React dashboard.

The current demo runtime is intentionally local-first:

- Backend: FastAPI
- Frontend: React/Vite
- Trace storage: SQLite (`selfsurgeon-backend/traces.db`)
- Prompt deployment: local prompt registry
- Healing loop: observe -> diagnose -> prescribe -> validate -> deploy -> audit

## What It Demonstrates

SelfSurgeon starts with an intentionally flawed lead-routing prompt. The victim agent misroutes boundary cases such as exactly 50 employees or exactly 1000 employees. The self-healing loop then:

1. Generates real traces through the backend.
2. Reads failed traces from the local trace database.
3. Classifies the failure type.
4. Synthesizes a corrected prompt.
5. Validates baseline vs candidate behavior.
6. Deploys the repaired prompt to the local prompt registry.
7. Shows that subsequent generated traces now pass.

No mock data is used in the main healing flow.

## Run Locally

Start the backend:

```bash
cd selfsurgeon-backend
python main.py
```

Start the frontend:

```bash
cd selfsurgeon
npm install
npm run dev
```

Open the Vite URL shown in the terminal, usually `http://localhost:5173`.

## Demo Flow

In the dashboard:

1. Generate failure traces.
2. Trigger self-healing.
3. Watch the diagnosis, validation, deployment, and surgery history update.
4. Generate again and confirm failures drop to zero.

## Architecture

```text
Victim agent -> SQLite trace store -> SelfSurgeon healer -> local prompt registry
                     |                         |
                     v                         v
              Trace analysis             Surgery history
                     \_________________________/
                               |
                               v
                         React dashboard
```

## Project Structure

```text
selfsurgeon/
  selfsurgeon-backend/
    main.py                 FastAPI entry point
    api/routes.py           Dashboard API routes
    agent/                  Observer, diagnostician, surgeon, validator, deployer, auditor
    victim/router_agent.py  Lead-routing victim agent and SQLite trace writer
    prompts/                Local prompt files
    traces.db               Local trace database

  selfsurgeon/
    src/                    React dashboard
    package.json            Frontend scripts
```

## Historical Note

Earlier prototypes explored Arize Phoenix and MCP integrations. Those references may remain in legacy adapter modules or historical notes, but the current live Windows demo is SQLite-backed and local trace-backed.
