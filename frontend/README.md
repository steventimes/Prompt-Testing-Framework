# Prompt Testing Framework Frontend

A React + Vite front end for building and evaluating prompt versions.

## Run locally

```bash
npm ci
npm run dev
```

## Build for deployment (mock mode)

The project is now deploy-friendly by default for demos:

- `VITE_USE_MOCK=true` enables in-browser mock API mode.
- No backend is required when mock mode is on.

```bash
VITE_USE_MOCK=true npm run build
npm run preview
```

## User history persistence

The app now keeps test history alive for the active browser tab using `sessionStorage`:

- Quick Playground session history persists until the tab/browser is closed.
- Prompt detail input/model/result state persists until the tab/browser is closed.

## GitHub Pages deployment workflow

A workflow exists at `.github/workflows/deploy-frontend.yml`.

### What it does

1. Installs dependencies from `frontend/package-lock.json`.
2. Builds the front end in **mock mode** (`VITE_USE_MOCK=true`).
3. Publishes `frontend/dist` to GitHub Pages.

### How to deploy

1. In GitHub, enable **Pages** and set source to **GitHub Actions**.
2. Push changes to `main` (or manually run **Deploy Frontend (Mock Mode)** from Actions).
3. Open the generated Pages URL from the workflow output.

> Note: `VITE_BASE_PATH` is set for this repository path (`/Prompt-Testing-Framework/`) in the workflow.


## QA-style test suite for larger codebase integration

A QA-authored regression suite is included:

- `frontend/tests/qa/frontend-regression-suite.md` (test matrix + detailed cases)
- `frontend/tests/qa/mock-mode-smoke.feature` (gherkin scenarios for BDD pipelines)

These are structured to plug into enterprise QA processes (entry/exit criteria, priority labels, case IDs, and reproducible steps).


## Property-based testing (available here)

Yes — lightweight property-based tests are now integrated without additional external dependencies.

- Test file: `frontend/tests/property/mockMath.property.test.mjs`
- Command: `npm run test:property`
- Runtime: Node built-in test runner (`node:test`)

Current properties validated:
- `ensureLeadingSlash` always returns a leading slash while preserving path content.
- `clamp` always returns values inside provided bounds.
- `average` always stays between min/max of input values and returns `0` for empty lists.

This is intentionally CI-friendly and can be extended later to fast-check/Jest/Vitest once package policy allows installing new libraries.
