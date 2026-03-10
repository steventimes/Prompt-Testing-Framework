import test from 'node:test'
import assert from 'node:assert/strict'
import { average, clamp, ensureLeadingSlash } from '../../src/lib/mockMath.js'

test('unit: average returns 0 for non-array and empty inputs', () => {
  assert.equal(average(), 0)
  assert.equal(average(null), 0)
  assert.equal(average([]), 0)
})

test('unit: average coerces values using Number(value || 0)', () => {
  assert.equal(average([1, '2', 3]), 2)
  assert.equal(average(['', false, 3]), 1)
})

test('unit: clamp bounds values and returns min for NaN-like values', () => {
  assert.equal(clamp(5, 0, 10), 5)
  assert.equal(clamp(-5, 0, 10), 0)
  assert.equal(clamp(99, 0, 10), 10)
  assert.equal(clamp('not-a-number', -2, 2), -2)
})

test('unit: ensureLeadingSlash adds slash exactly when needed', () => {
  assert.equal(ensureLeadingSlash('abc'), '/abc')
  assert.equal(ensureLeadingSlash('/abc'), '/abc')
  assert.equal(ensureLeadingSlash(''), '/')
})
