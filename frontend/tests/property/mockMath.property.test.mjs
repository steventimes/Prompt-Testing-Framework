import test from 'node:test'
import assert from 'node:assert/strict'
import { average, clamp, ensureLeadingSlash } from '../../src/lib/mockMath.js'

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const randomArray = (len, min = -1000, max = 1000) => Array.from({ length: len }, () => randomInt(min, max))

test('property: clamp result always lies in [min, max] when min <= max', () => {
  for (let i = 0; i < 10000; i += 1) {
    const min = randomInt(-1000, 0)
    const max = randomInt(1, 1000)
    const value = randomInt(-10000, 10000)
    const out = clamp(value, min, max)
    assert.equal(out >= min && out <= max, true)
  }
})

test('property: clamp is idempotent', () => {
  for (let i = 0; i < 10000; i += 1) {
    const min = randomInt(-1000, 0)
    const max = randomInt(1, 1000)
    const value = randomInt(-10000, 10000)
    const once = clamp(value, min, max)
    const twice = clamp(once, min, max)
    assert.equal(once, twice)
  }
})

test('property: average output is bounded by min/max for non-empty numeric arrays', () => {
  for (let i = 0; i < 4000; i += 1) {
    const len = randomInt(1, 40)
    const values = randomArray(len)
    const result = average(values)
    assert.equal(result >= Math.min(...values) && result <= Math.max(...values), true)
  }
})

test('property: ensureLeadingSlash is idempotent and always prefixed with /', () => {
  for (let i = 0; i < 4000; i += 1) {
    const len = randomInt(0, 32)
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789-_/'
    const candidate = Array.from({ length: len }, () => chars[randomInt(0, chars.length - 1)]).join('')
    const once = ensureLeadingSlash(candidate)
    const twice = ensureLeadingSlash(once)
    assert.equal(once.startsWith('/'), true)
    assert.equal(once, twice)
  }
})
