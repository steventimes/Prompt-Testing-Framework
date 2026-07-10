# Java AI Prompt Testing Framework

A PromptOps workspace for testing, versioning, comparing, and governing LLM prompts.

## Product direction

The project is evolving from a developer utility into an enterprise-ready prompt experimentation platform:

- Prompt portfolio dashboard with readiness and challenger coverage metrics.
- Version-controlled prompt library with comparison workflows.
- Quick playground for local evaluation and demo-safe mock mode.
- Governance queue for prompts missing owner context, challenger versions, or recent review.
- Release governance gate with publishable counts, blockers, required checks, and rollout risk disclosure.
- JSON/API-friendly frontend data model designed to connect to the Spring backend.

## Backend product API

The Spring backend now exposes the PromptOps workspace contract used by the frontend:

- `GET /api/workspace/summary` returns portfolio readiness, challenger coverage, release governance, and governance queue rows.
- Prompt, prompt-version, quick-test, and test-run APIs back the core experimentation flow.
- The workspace summary mirrors the frontend mock analytics rules so demo and live modes use the same product semantics.
- Release governance uses `PromptOps.ReleaseGovernance.v1` and blocks rollout when prompts lack versions, owner context, challenger versions, or recent review.

Planned backend expansion remains focused on CI-style gates for prompt quality, latency, cost, and regression thresholds.

## Frontend development

Prerequisites:

- Node.js 20.19+ for the current Vite/Rolldown toolchain.
- npm 9+.

```bash
cd frontend
npm install
npm run dev
```

Mock mode is enabled by default for local demos. Set `VITE_USE_MOCK=false` and `VITE_API_BASE_URL` to connect to a backend.

## Verification

```bash
cd frontend
npm run test:all
npm run build
```
