import test from 'node:test'
import assert from 'node:assert/strict'

import { average, clamp, ensureLeadingSlash } from '../../src/lib/mockMath.js'

// Source: tests/sanity/mockMath.smoke.test.mjs
{
  test('smoke: mockMath exports are callable and produce deterministic baseline values', () => {
    assert.equal(typeof average, 'function')
    assert.equal(typeof clamp, 'function')
    assert.equal(typeof ensureLeadingSlash, 'function')

    assert.equal(average([2, 4, 6]), 4)
    assert.equal(clamp(15, 0, 10), 10)
    assert.equal(ensureLeadingSlash('health'), '/health')
  })
}

// Source: tests/fuzz/mockMath.fuzz.test.mjs
{
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
  const randMaybeNumeric = () => {
    const options = [
      () => randInt(-10000, 10000),
      () => `${randInt(-10000, 10000)}`,
      () => Number.NaN,
      () => '',
      () => null,
      () => undefined,
      () => false,
      () => true,
      () => ({ bad: 'type' }),
    ]
    return options[randInt(0, options.length - 1)]()
  }

  const randPath = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789-_/'
    const len = randInt(0, 50)
    let out = ''
    for (let i = 0; i < len; i += 1) out += chars[randInt(0, chars.length - 1)]
    return Math.random() < 0.1 ? `/${out}` : out
  }

  test('fuzz: clamp and ensureLeadingSlash never throw on random values', () => {
    for (let i = 0; i < 10000; i += 1) {
      const min = randInt(-5000, 0)
      const max = randInt(1, 5000)
      const value = randMaybeNumeric()
      assert.doesNotThrow(() => clamp(value, min, max))

      const path = randPath()
      assert.doesNotThrow(() => ensureLeadingSlash(path))
    }
  })

  test('fuzz: average never throws on heterogeneous arrays', () => {
    for (let i = 0; i < 5000; i += 1) {
      const length = randInt(0, 60)
      const values = Array.from({ length }, randMaybeNumeric)
      assert.doesNotThrow(() => average(values))
    }
  })
}

// Source: tests/property/mockMath.property.test.mjs
{
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
}

// Source: tests/model/mockMath.model.test.mjs
{
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
}
