import test from 'node:test'
import assert from 'node:assert/strict'
import { clamp, ensureLeadingSlash } from '../../src/lib/mockMath.js'

test('model-check: clamp equals mathematical spec for full finite domain', () => {
  for (let min = -3; min <= 2; min += 1) {
    for (let max = min; max <= 3; max += 1) {
      for (let value = -5; value <= 5; value += 1) {
        const expected = Math.min(Math.max(value, min), max)
        assert.equal(clamp(value, min, max), expected)
      }
    }
  }
})

test('model-check: ensureLeadingSlash matches spec for exhaustive short strings', () => {
  const alphabet = ['a', '/', '-', '']
  const generate = (depth, prefix = '', out = []) => {
    if (depth === 0) {
      out.push(prefix)
      return out
    }
    for (const ch of alphabet) generate(depth - 1, prefix + ch, out)
    return out
  }

  const candidates = new Set([
    '',
    ...generate(1),
    ...generate(2),
    ...generate(3),
  ])

  for (const candidate of candidates) {
    const expected = candidate.startsWith('/') ? candidate : `/${candidate}`
    assert.equal(ensureLeadingSlash(candidate), expected)
  }
})
