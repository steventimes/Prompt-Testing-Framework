import test from 'node:test'
import assert from 'node:assert/strict'
import { average, clamp, ensureLeadingSlash } from '../../src/lib/mockMath.js'

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
