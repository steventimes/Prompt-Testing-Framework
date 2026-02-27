# Frontend Regression Suite (QA Authored)

This suite is intentionally written in a QA style so it can be imported into larger release/testing workflows.

## Scope
- Product: Prompt Testing Framework frontend
- Execution mode: Mock mode (`VITE_USE_MOCK=true`)
- Target: Browser-based functional regression before deployment

## Entry Criteria
- Frontend branch is merged or in release candidate state.
- `npm run lint` passes.
- `npm run build` passes.

## Exit Criteria
- All P0 and P1 tests pass.
- No unresolved critical UI defects.
- Deploy workflow run publishes artifact successfully.

---

## Test Matrix

| ID | Priority | Area | Scenario | Expected Result |
|---|---|---|---|---|
| FE-MOCK-001 | P0 | App Boot | Open home page with no backend | Home renders successfully with prompt cards and no network dependency |
| FE-MOCK-002 | P0 | Prompt CRUD | Create a new prompt from Create screen | Prompt is created and appears in library |
| FE-MOCK-003 | P0 | Quick Playground | Run quick test with one input | Result card shows mock response and metrics |
| FE-MOCK-004 | P0 | Session Persistence | Reload tab after running quick test | Session history still visible in same tab |
| FE-MOCK-005 | P0 | Prompt Detail Persistence | Set model/input on prompt detail and reload | Selected model/input/result remains in same tab |
| FE-MOCK-006 | P1 | Compare Versions | Execute comparison between two versions | Two side-by-side result cards are populated |
| FE-UI-007 | P1 | Visual Quality | Validate hero/cards layout at desktop and mobile widths | No overlap, clipped content, or broken CTA controls |
| FE-DEPLOY-008 | P0 | Deployment | Run deploy workflow in mock mode | Pages artifact is generated and deploy succeeds |

---

## Detailed Cases

### FE-MOCK-004 — Session Persistence (Quick Playground)
**Preconditions**
- User is on Home.

**Steps**
1. Open **Quick Playground**.
2. Enter test input.
3. Click **Run Quick Test**.
4. Confirm result appears.
5. Refresh the page.

**Expected**
- Session history panel still contains latest run.
- History is removed only after tab/browser closes.

### FE-MOCK-005 — Session Persistence (Prompt Detail)
**Preconditions**
- At least one prompt exists.

**Steps**
1. Open a prompt detail page.
2. Select a model and enter test inputs.
3. Run test.
4. Refresh the page.

**Expected**
- Selected version, model, inputs, and latest result are restored.
- Persistence is scoped to active browser session.

---

## Non-Functional Checks
- Accessibility smoke: keyboard focus must reach primary actions (New Prompt, Quick Playground, Run Test).
- Performance smoke: first meaningful content should render without blocking calls to backend in mock mode.
- Reliability: no uncaught errors in browser console during core flows.

## Defect Logging Format
- **Title**: `[Frontend][Area] short summary`
- **Environment**: browser + version + commit SHA
- **Repro Steps**: numbered sequence
- **Observed** vs **Expected**
- **Severity**: Critical / Major / Minor
- **Artifacts**: screenshot + console excerpt
