import test from 'node:test'
import assert from 'node:assert/strict'
import { average, clamp, ensureLeadingSlash } from '../../src/lib/mockMath.js'

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

const randomString = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789-_'
  const length = randomInt(1, 16)
  let out = ''
  for (let i = 0; i < length; i += 1) {
    out += chars[randomInt(0, chars.length - 1)]
  }
  return out
}

test('property: ensureLeadingSlash always returns value with leading slash', () => {
  for (let i = 0; i < 300; i += 1) {
    const candidate = Math.random() < 0.5 ? randomString() : `/${randomString()}`
    const result = ensureLeadingSlash(candidate)

    assert.equal(result.startsWith('/'), true)
    assert.equal(result.replace(/^\/+/, ''), candidate.replace(/^\/+/, ''))
  }
})

test('property: clamp output is always within inclusive bounds', () => {
  for (let i = 0; i < 1000; i += 1) {
    const min = randomInt(-1000, 0)
    const max = randomInt(1, 1000)
    const value = randomInt(-5000, 5000)

    const result = clamp(value, min, max)
    assert.equal(result >= min && result <= max, true)
  }
})

test('property: average is bounded by min/max of numeric input', () => {
  for (let i = 0; i < 300; i += 1) {
    const length = randomInt(1, 40)
    const values = Array.from({ length }, () => randomInt(-500, 500))
    const result = average(values)

    const min = Math.min(...values)
    const max = Math.max(...values)
    assert.equal(result >= min && result <= max, true)
  }
})

test('property: average returns 0 for empty arrays', () => {
  assert.equal(average([]), 0)
})
