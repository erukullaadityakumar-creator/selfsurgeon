# SelfSurgeon Backend

FastAPI backend for the SelfSurgeon local demo runtime.

## What It Does

- Generates failing victim-agent traces into the local SQLite trace database.
- Observes failed trace records through the local evaluation layer.
- Diagnoses failure patterns.
- Generates corrected prompts using Gemini when configured, with deterministic fallback for boundary ambiguity.
- Validates fixes through local baseline-vs-candidate checks.
- Deploys winning prompt versions into the local prompt registry.
- Keeps surgery history for the React dashboard.
- Exposes REST endpoints for generating failures, triggering self-healing, reading traces, and viewing prompt state.

## Run Locally

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python main.py
```

Generate victim traces:

```bash
python victim/router_agent.py
```

Trigger one surgery:

```bash
curl -X POST http://localhost:8000/api/trigger
```

Health:

```bash
curl http://localhost:8000/api/health
```

## Runtime Notes

The live demo is SQLite-backed and local-first:

- Trace records are stored in `traces.db`.
- The self-healing loop reads failed traces from the local trace store.
- Prompt deployment updates the local prompt registry used by the victim agent.
- Surgery history is maintained locally for dashboard display.

Some legacy Phoenix/MCP adapter modules remain in the tree for earlier prototype compatibility and future integration work, but they are not required for the current Windows local demo flow.

## API

- `GET /api/health`
- `GET /api/surgeries?limit=50`
- `GET /api/traces?failed_only=true&limit=50`
- `GET /api/prompts/current`
- `POST /api/trigger`
- `POST /api/victim/generate?count=50`
