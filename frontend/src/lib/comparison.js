const isKnownNumber = (value) => value != null && value !== '' && Number.isFinite(Number(value))
const number = (value) => isKnownNumber(value) ? Number(value) : 0

// 这四项都进入综合公式；缺任何一项时，分数不再是假设未知值为零。
const scoringEvidenceFields = [
  'averageQualityScore',
  'averageResponseTimeMs',
  'totalCostUsd',
  'averagePrivacyRiskScore',
]

const difference = (left, right) => (
  isKnownNumber(left) && isKnownNumber(right) ? Number(left) - Number(right) : null
)

export function scoreRun(metrics = {}) {
  if (!scoringEvidenceFields.every((field) => isKnownNumber(metrics[field]))) return null

  // 旧运行没有断言时按中性满分处理，避免升级后历史记录被无端降权。
  const assertionScore = number(metrics.totalAssertions) > 0
    ? number(metrics.assertionPassRate) * 40
    : 40
  return (
    number(metrics.averageQualityScore) * 100
    + assertionScore
    - number(metrics.averageResponseTimeMs) / 100
    - number(metrics.totalCostUsd) * 1000
    - number(metrics.averagePrivacyRiskScore) * 20
  )
}

export function compareRuns(leftRun, rightRun) {
  const left = leftRun?.metrics || {}
  const right = rightRun?.metrics || {}
  const leftScore = scoreRun(left)
  const rightScore = scoreRun(right)
  const comparable = leftScore != null && rightScore != null
  const scoreDelta = comparable ? leftScore - rightScore : null

  return {
    leftScore: comparable ? leftScore : null,
    rightScore: comparable ? rightScore : null,
    winner: comparable ? (Math.abs(scoreDelta) < 1 ? 'tie' : scoreDelta > 0 ? 'left' : 'right') : 'incomparable',
    deltas: {
      quality: difference(left.averageQualityScore, right.averageQualityScore),
      assertionPassRate: number(left.assertionPassRate) - number(right.assertionPassRate),
      latencyMs: difference(left.averageResponseTimeMs, right.averageResponseTimeMs),
      costUsd: difference(left.totalCostUsd, right.totalCostUsd),
      privacyRisk: difference(left.averagePrivacyRiskScore, right.averagePrivacyRiskScore),
    },
  }
}
