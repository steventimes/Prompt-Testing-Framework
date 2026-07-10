const DAY_MS = 24 * 60 * 60 * 1000

export const parseDateMs = (value, fallback = Date.now()) => {
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? fallback : parsed
}

export const getLatestPromptActivity = (prompt, now = Date.now()) => {
  const created = parseDateMs(prompt.createdAt, now)
  const versionDates = (prompt.versions || []).map((version) => parseDateMs(version.createdAt, created))
  return Math.max(created, ...versionDates)
}

export const classifyPromptReadiness = (prompt, now = Date.now()) => {
  const versionCount = prompt.versions?.length || 0
  const hasDescription = Boolean(prompt.description?.trim())
  const ageDays = Math.floor((now - getLatestPromptActivity(prompt, now)) / DAY_MS)

  if (versionCount === 0) {
    return {
      level: 'blocked',
      label: 'Needs version',
      reason: 'No prompt version is available for testing.',
    }
  }

  if (!hasDescription) {
    return {
      level: 'attention',
      label: 'Needs owner context',
      reason: 'Description is missing, which weakens review and handoff quality.',
    }
  }

  if (versionCount < 2) {
    return {
      level: 'attention',
      label: 'Needs challenger',
      reason: 'Only one version exists, so there is no A/B comparison baseline.',
    }
  }

  if (ageDays > 14) {
    return {
      level: 'watch',
      label: 'Review stale',
      reason: 'No recent activity in more than 14 days.',
    }
  }

  return {
    level: 'ready',
    label: 'Experiment ready',
    reason: 'Prompt has documentation and at least one challenger version.',
  }
}


export const buildReleaseGovernance = (rows = []) => {
  const blockers = rows
    .filter((row) => row.readiness.level !== 'ready')
    .map((row) => ({
      promptId: row.id,
      promptName: row.name,
      code: releaseBlockerCode(row.readiness.level),
      message: row.readiness.reason,
    }))

  return {
    schema: 'PromptOps.ReleaseGovernance.v1',
    releaseDecision: blockers.length === 0 ? 'approved' : 'blocked',
    publishableCount: rows.length - blockers.length,
    blockedCount: blockers.length,
    blockers,
    requiredChecks: [
      'prompt has at least one tested version',
      'prompt has owner context',
      'prompt has at least one challenger version',
      'prompt has activity within 14 days',
    ],
    verificationCommands: [
      'cd frontend && npm run test:all',
      'cd backend && mvn test -Dtest=WorkspaceDashboardServiceTest',
    ],
    riskDisclosure: 'Release approval means the prompt is structurally ready for controlled rollout; it does not certify model safety, legal approval, or production traffic eligibility.',
  }
}

export const buildAuditEvidence = (rows = [], now = Date.now()) => {
  const generatedAt = new Date(now).toISOString()
  const evidenceItemCount = rows.reduce(
    (sum, row) => sum + 4 + (row.readiness.level === 'ready' ? 0 : 1),
    0,
  )

  return {
    schema: 'PromptOps.AuditEvidence.v1',
    artifactId: `promptops-workspace-${generatedAt.slice(0, 10)}`,
    generatedAt,
    retentionPolicy: 'retain release evidence, blocker history, and verification commands for at least 180 days',
    governedPromptCount: rows.length,
    evidenceItemCount,
    evidenceItems: [
      'prompt identity and owner context',
      'version count and latest activity timestamp',
      'readiness classification and reason',
      'release blocker code and message when applicable',
      'verification command list for frontend and backend checks',
    ],
    controlOwners: ['Prompt owner', 'PromptOps reviewer', 'Release manager'],
    exportFormats: ['workspace summary API JSON', 'release governance JSON', 'audit evidence JSON'],
    riskDisclosure: 'Audit evidence proves structural reviewability of the prompt workspace; it does not replace model safety, legal, privacy, or production approval sign-off.',
  }
}

const releaseBlockerCode = (level) => {
  if (level === 'blocked') return 'PROMPT_BLOCKED'
  if (level === 'attention') return 'PROMPT_NEEDS_REVIEW'
  if (level === 'watch') return 'PROMPT_REVIEW_STALE'
  return 'PROMPT_NOT_RELEASE_READY'
}

export const summarizeWorkspace = (prompts = [], now = Date.now()) => {
  const rows = prompts.map((prompt) => {
    const readiness = classifyPromptReadiness(prompt, now)
    return {
      id: prompt.id,
      name: prompt.name,
      description: prompt.description || '',
      createdAt: prompt.createdAt,
      versionCount: prompt.versions?.length || 0,
      latestActivityMs: getLatestPromptActivity(prompt, now),
      readiness,
    }
  })

  const totalVersions = rows.reduce((sum, row) => sum + row.versionCount, 0)
  const readyCount = rows.filter((row) => row.readiness.level === 'ready').length
  const attentionCount = rows.filter((row) => row.readiness.level !== 'ready').length
  const promptsWithChallengers = rows.filter((row) => row.versionCount >= 2).length
  const readinessScore = prompts.length ? Math.round((readyCount / prompts.length) * 100) : 0
  const challengerCoverage = prompts.length ? Math.round((promptsWithChallengers / prompts.length) * 100) : 0

  const sortedRows = rows.sort((a, b) => b.latestActivityMs - a.latestActivityMs)

  return {
    totalPrompts: prompts.length,
    totalVersions,
    averageVersions: prompts.length ? Number((totalVersions / prompts.length).toFixed(1)) : 0,
    readyCount,
    attentionCount,
    readinessScore,
    challengerCoverage,
    releaseGovernance: buildReleaseGovernance(sortedRows),
    auditEvidence: buildAuditEvidence(sortedRows, now),
    rows: sortedRows,
  }
}
