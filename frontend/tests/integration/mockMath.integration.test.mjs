import test from 'node:test'
import assert from 'node:assert/strict'
import { average, clamp, ensureLeadingSlash } from '../../src/lib/mockMath.js'

const normalizeScores = (scores) => {
  const mean = average(scores)
  const bounded = clamp(mean, 0, 100)
  return {
    endpoint: ensureLeadingSlash('scores/summary'),
    mean,
    bounded,
  }
}

test('integration: composed workflow returns stable endpoint and bounded aggregate', () => {
  const result = normalizeScores([40, 50, 200])
  assert.equal(result.endpoint, '/scores/summary')
  assert.equal(result.mean, (40 + 50 + 200) / 3)
  assert.equal(result.bounded, 96.66666666666667)
})

test('integration: empty score list degrades safely through composition', () => {
  const result = normalizeScores([])
  assert.equal(result.endpoint, '/scores/summary')
  assert.equal(result.mean, 0)
  assert.equal(result.bounded, 0)
})
