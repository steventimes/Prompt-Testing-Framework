import test from 'node:test'
import assert from 'node:assert/strict'
import { average, clamp, ensureLeadingSlash } from '../../src/lib/mockMath.js'

test('smoke: mockMath exports are callable and produce deterministic baseline values', () => {
  assert.equal(typeof average, 'function')
  assert.equal(typeof clamp, 'function')
  assert.equal(typeof ensureLeadingSlash, 'function')

  assert.equal(average([2, 4, 6]), 4)
  assert.equal(clamp(15, 0, 10), 10)
  assert.equal(ensureLeadingSlash('health'), '/health')
})
