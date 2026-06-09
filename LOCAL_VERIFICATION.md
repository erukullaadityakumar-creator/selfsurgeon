# SelfSurgeon Local Verification

Date: 2026-05-30

## Current Runtime

- Backend: FastAPI, started from `selfsurgeon-backend` with `python main.py`.
- Frontend: React/Vite, started from `selfsurgeon` with `npm run dev`.
- Trace storage: `selfsurgeon-backend/traces.db` SQLite.
- Prompt deployment: local prompt registry.
- Healing loop: observes local failed traces, validates a repaired prompt, deploys it, and records surgery history.

## Expected Demo Check

1. Generate failure traces from the dashboard or `POST /api/victim/generate`.
2. Confirm failed traces appear in Trace Analysis.
3. Trigger self-healing with `POST /api/trigger` or the dashboard action.
4. Confirm the surgery record shows `DEPLOYED`.
5. Generate traces again and confirm failures drop to zero.

## Verified Frontend Build

```text
vite v6.4.2 building for production...
modules transformed
built successfully
```

## Historical Note

Earlier verification notes referenced a Phoenix-backed prototype. The current live Windows demo is SQLite-backed and does not require Phoenix or MCP.
