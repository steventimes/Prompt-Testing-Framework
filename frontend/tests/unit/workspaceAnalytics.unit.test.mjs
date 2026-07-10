import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAuditEvidence, buildReleaseGovernance, classifyPromptReadiness, summarizeWorkspace } from '../../src/lib/workspaceAnalytics.js'

const now = Date.parse('2026-07-09T00:00:00.000Z')

const prompt = (overrides = {}) => ({
  id: 1,
  name: 'Prompt',
  description: 'Documented prompt',
  createdAt: '2026-07-07T00:00:00.000Z',
  versions: [
    { id: 11, versionNumber: 1, createdAt: '2026-07-07T00:00:00.000Z', content: 'A' },
    { id: 12, versionNumber: 2, createdAt: '2026-07-08T00:00:00.000Z', content: 'B' },
  ],
  ...overrides,
})

test('classifyPromptReadiness marks documented challenger prompts as ready', () => {
  const readiness = classifyPromptReadiness(prompt(), now)
  assert.equal(readiness.level, 'ready')
  assert.equal(readiness.label, 'Experiment ready')
})

test('classifyPromptReadiness identifies governance gaps in priority order', () => {
  assert.equal(classifyPromptReadiness(prompt({ versions: [] }), now).level, 'blocked')
  assert.equal(classifyPromptReadiness(prompt({ description: '' }), now).label, 'Needs owner context')
  assert.equal(classifyPromptReadiness(prompt({ versions: [prompt().versions[0]] }), now).label, 'Needs challenger')
  assert.equal(
    classifyPromptReadiness(prompt({ createdAt: '2026-06-01T00:00:00.000Z', versions: [
      { id: 11, versionNumber: 1, createdAt: '2026-06-01T00:00:00.000Z', content: 'A' },
      { id: 12, versionNumber: 2, createdAt: '2026-06-02T00:00:00.000Z', content: 'B' },
    ] }), now).label,
    'Review stale',
  )
})

test('summarizeWorkspace returns portfolio metrics and sorts by latest activity', () => {
  const summary = summarizeWorkspace([
    prompt({ id: 1, name: 'Older', createdAt: '2026-07-01T00:00:00.000Z', versions: [
      { id: 11, versionNumber: 1, createdAt: '2026-07-01T00:00:00.000Z', content: 'A' },
    ] }),
    prompt({ id: 2, name: 'Newest' }),
    prompt({ id: 3, name: 'Blocked', versions: [] }),
  ], now)

  assert.equal(summary.totalPrompts, 3)
  assert.equal(summary.totalVersions, 3)
  assert.equal(summary.averageVersions, 1)
  assert.equal(summary.readyCount, 1)
  assert.equal(summary.attentionCount, 2)
  assert.equal(summary.readinessScore, 33)
  assert.equal(summary.challengerCoverage, 33)
  assert.equal(summary.releaseGovernance.schema, 'PromptOps.ReleaseGovernance.v1')
  assert.equal(summary.releaseGovernance.releaseDecision, 'blocked')
  assert.equal(summary.releaseGovernance.publishableCount, 1)
  assert.equal(summary.releaseGovernance.blockedCount, 2)
  assert.deepEqual(new Set(summary.releaseGovernance.blockers.map((item) => item.code)), new Set(['PROMPT_NEEDS_REVIEW', 'PROMPT_BLOCKED']))
  assert.equal(summary.auditEvidence.schema, 'PromptOps.AuditEvidence.v1')
  assert.equal(summary.auditEvidence.governedPromptCount, 3)
  assert.equal(summary.auditEvidence.evidenceItemCount, 14)
  assert.ok(summary.auditEvidence.riskDisclosure.includes('does not replace model safety'))
  assert.equal(summary.rows[0].name, 'Newest')
})

test('buildReleaseGovernance approves fully ready portfolios', () => {
  const rows = [
    { id: 10, name: 'Ready', readiness: { level: 'ready', reason: 'ok' } },
  ]

  const governance = buildReleaseGovernance(rows)

  assert.equal(governance.releaseDecision, 'approved')
  assert.equal(governance.publishableCount, 1)
  assert.equal(governance.blockedCount, 0)
  assert.deepEqual(governance.blockers, [])
  assert.ok(governance.riskDisclosure.includes('controlled rollout'))
})

test('buildAuditEvidence creates a release review artifact contract', () => {
  const rows = [
    { id: 10, name: 'Ready', readiness: { level: 'ready', reason: 'ok' } },
    { id: 11, name: 'Blocked', readiness: { level: 'blocked', reason: 'missing version' } },
  ]

  const evidence = buildAuditEvidence(rows, now)

  assert.equal(evidence.schema, 'PromptOps.AuditEvidence.v1')
  assert.equal(evidence.artifactId, 'promptops-workspace-2026-07-09')
  assert.equal(evidence.governedPromptCount, 2)
  assert.equal(evidence.evidenceItemCount, 9)
  assert.deepEqual(evidence.controlOwners, ['Prompt owner', 'PromptOps reviewer', 'Release manager'])
  assert.ok(evidence.exportFormats.includes('audit evidence JSON'))
})
