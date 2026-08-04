/**
 * Unit tests for the conversion module (Team Member 1).
 *
 * Run with `npm test`. These use Node's built-in test runner, so no extra
 * dependency is needed; Node executes the TypeScript directly by stripping the
 * type annotations.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  MAX_BITS,
  MIN_BITS,
  bitsToSigned,
  convertBinary,
  convertDecimal,
  fromSignedBinary,
  fromUnsignedBinary,
  groupBits,
  parseBinary,
  parseDecimal,
  readOperand,
  signedMax,
  signedMin,
  toHex,
  toSignedBinary,
  toUnsignedBinary,
  twosComplementSteps,
  unsignedMax,
  wrapToBits,
} from '../src/lib/conversion.ts'
import { MachineError } from '../src/lib/errors.ts'

/** Asserts that `fn` throws a MachineError carrying the expected code. */
function throwsCode(fn: () => unknown, code: string): void {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof MachineError, `expected MachineError, got ${String(error)}`)
    assert.equal(error.code, code)
    return true
  })
}

describe('data size validation', () => {
  it('accepts the documented range', () => {
    assert.equal(unsignedMax(MIN_BITS), 3n)
    assert.equal(unsignedMax(8), 255n)
    assert.equal(unsignedMax(64), 18_446_744_073_709_551_615n)
    assert.equal(signedMin(64), -9_223_372_036_854_775_808n)
    assert.equal(signedMax(64), 9_223_372_036_854_775_807n)
    // "and beyond"
    assert.equal(unsignedMax(128), (1n << 128n) - 1n)
    assert.equal(signedMax(MAX_BITS), (1n << BigInt(MAX_BITS - 1)) - 1n)
  })

  it('rejects sizes outside the range', () => {
    throwsCode(() => unsignedMax(1), 'INVALID_BITS')
    throwsCode(() => unsignedMax(0), 'INVALID_BITS')
    throwsCode(() => unsignedMax(-8), 'INVALID_BITS')
    throwsCode(() => unsignedMax(MAX_BITS + 1), 'INVALID_BITS')
    throwsCode(() => unsignedMax(8.5), 'INVALID_BITS')
    throwsCode(() => unsignedMax(Number.NaN), 'INVALID_BITS')
  })
})

describe('parseDecimal', () => {
  it('reads signed integers and tolerates separators', () => {
    assert.equal(parseDecimal('42'), 42n)
    assert.equal(parseDecimal('  -7 '), -7n)
    assert.equal(parseDecimal('+9'), 9n)
    assert.equal(parseDecimal('-1,048,576'), -1_048_576n)
    assert.equal(parseDecimal('1_000'), 1000n)
    // Well past Number.MAX_SAFE_INTEGER: exactness is the reason for bigint.
    assert.equal(parseDecimal('9007199254740993'), 9_007_199_254_740_993n)
  })

  it('rejects malformed input', () => {
    throwsCode(() => parseDecimal(''), 'EMPTY_INPUT')
    throwsCode(() => parseDecimal('   '), 'EMPTY_INPUT')
    throwsCode(() => parseDecimal('-'), 'EMPTY_INPUT')
    throwsCode(() => parseDecimal('3.5'), 'INVALID_DECIMAL')
    throwsCode(() => parseDecimal('12abc'), 'INVALID_DECIMAL')
    throwsCode(() => parseDecimal('0x1F'), 'INVALID_DECIMAL')
    throwsCode(() => parseDecimal('--4'), 'INVALID_DECIMAL')
  })
})

describe('parseBinary', () => {
  it('normalises to the data size', () => {
    assert.equal(parseBinary('101', 8), '00000101')
    assert.equal(parseBinary('0b1010', 8), '00001010')
    assert.equal(parseBinary('1010 1100', 8), '10101100')
    assert.equal(parseBinary('11111111', 8), '11111111')
  })

  it('rejects bad digits and oversized literals', () => {
    throwsCode(() => parseBinary('', 8), 'EMPTY_INPUT')
    throwsCode(() => parseBinary('1021', 8), 'INVALID_BINARY')
    throwsCode(() => parseBinary('abc', 8), 'INVALID_BINARY')
    throwsCode(() => parseBinary('101010101', 8), 'BINARY_TOO_LONG')
  })
})

describe('decimal to unsigned binary', () => {
  it('converts in-range values', () => {
    assert.equal(toUnsignedBinary(0n, 2), '00')
    assert.equal(toUnsignedBinary(3n, 2), '11')
    assert.equal(toUnsignedBinary(5n, 4), '0101')
    assert.equal(toUnsignedBinary(200n, 8), '11001000')
    assert.equal(toUnsignedBinary(255n, 8), '11111111')
    assert.equal(toUnsignedBinary(unsignedMax(64), 64), '1'.repeat(64))
    assert.equal(toUnsignedBinary(unsignedMax(100), 100), '1'.repeat(100))
  })

  it('rejects out-of-bounds values', () => {
    throwsCode(() => toUnsignedBinary(-1n, 8), 'OUT_OF_RANGE')
    throwsCode(() => toUnsignedBinary(256n, 8), 'OUT_OF_RANGE')
    throwsCode(() => toUnsignedBinary(4n, 2), 'OUT_OF_RANGE')
    throwsCode(() => toUnsignedBinary(1n << 64n, 64), 'OUT_OF_RANGE')
  })
})

describe('decimal to signed binary (two\'s complement)', () => {
  it('converts positive, zero and negative values', () => {
    assert.equal(toSignedBinary(0n, 8), '00000000')
    assert.equal(toSignedBinary(5n, 8), '00000101')
    assert.equal(toSignedBinary(-5n, 8), '11111011')
    assert.equal(toSignedBinary(-1n, 8), '11111111')
    assert.equal(toSignedBinary(127n, 8), '01111111')
    assert.equal(toSignedBinary(-128n, 8), '10000000')
    assert.equal(toSignedBinary(1n, 2), '01')
    assert.equal(toSignedBinary(-2n, 2), '10')
  })

  it('handles the asymmetric edges of wide words', () => {
    assert.equal(toSignedBinary(signedMin(64), 64), `1${'0'.repeat(63)}`)
    assert.equal(toSignedBinary(signedMax(64), 64), `0${'1'.repeat(63)}`)
    throwsCode(() => toSignedBinary(128n, 8), 'OUT_OF_RANGE')
    throwsCode(() => toSignedBinary(-129n, 8), 'OUT_OF_RANGE')
    throwsCode(() => toSignedBinary(signedMax(64) + 1n, 64), 'OUT_OF_RANGE')
  })

  it('round-trips through the binary reader', () => {
    for (const value of [-128n, -37n, -1n, 0n, 1n, 99n, 127n]) {
      assert.equal(fromSignedBinary(toSignedBinary(value, 8), 8), value)
    }
    for (const value of [0n, 1n, 128n, 255n]) {
      assert.equal(fromUnsignedBinary(toUnsignedBinary(value, 8), 8), value)
    }
  })
})

describe('twosComplementSteps', () => {
  it('shows magnitude, inversion and increment', () => {
    assert.deepEqual(twosComplementSteps(-5n, 8), {
      magnitude: '00000101',
      inverted: '11111010',
      result: '11111011',
    })
    // The most negative value is its own two's complement.
    assert.deepEqual(twosComplementSteps(-128n, 8), {
      magnitude: '10000000',
      inverted: '01111111',
      result: '10000000',
    })
  })

  it('is null for non-negative values', () => {
    assert.equal(twosComplementSteps(0n, 8), null)
    assert.equal(twosComplementSteps(7n, 8), null)
  })
})

describe('bit helpers', () => {
  it('wraps values into a fixed width', () => {
    assert.equal(wrapToBits(-1n, 6), '111111')
    assert.equal(wrapToBits(-3n, 6), '111101')
    assert.equal(wrapToBits(5n, 6), '000101')
  })

  it('reads two\'s complement back', () => {
    assert.equal(bitsToSigned('111101'), -3n)
    assert.equal(bitsToSigned('000101'), 5n)
  })

  it('groups and hex-formats', () => {
    assert.equal(groupBits('11001000'), '1100 1000')
    assert.equal(groupBits('101010'), '10 1010')
    assert.equal(toHex('11001000'), 'C8')
    assert.equal(toHex('1111'), 'F')
  })
})

describe('convertDecimal', () => {
  it('reports both representations for a positive value', () => {
    const result = convertDecimal('100', 8)
    assert.equal(result.value, 100n)
    assert.deepEqual(result.unsigned, {
      ok: true,
      binary: '01100100',
      grouped: '0110 0100',
      hex: '64',
    })
    assert.ok(result.signed.ok && result.signed.binary === '01100100')
    assert.equal(result.signedSteps, null)
  })

  it('reports unsigned as out of bounds for a negative value', () => {
    const result = convertDecimal('-100', 8)
    assert.equal(result.unsigned.ok, false)
    assert.ok(result.signed.ok && result.signed.binary === '10011100')
    assert.ok(result.signedSteps !== null)
  })

  it('reports signed as out of bounds when only unsigned fits', () => {
    const result = convertDecimal('200', 8)
    assert.ok(result.unsigned.ok && result.unsigned.binary === '11001000')
    assert.equal(result.signed.ok, false)
  })

  it('reports both as out of bounds when the value is far too large', () => {
    const result = convertDecimal('1000', 8)
    assert.equal(result.unsigned.ok, false)
    assert.equal(result.signed.ok, false)
    assert.deepEqual(result.ranges.signed, { min: -128n, max: 127n })
  })
})

describe('convertBinary', () => {
  it('reads one pattern under both interpretations', () => {
    const result = convertBinary('11111101', 8)
    assert.equal(result.unsignedValue, 253n)
    assert.equal(result.signedValue, -3n)
    assert.equal(result.hex, 'FD')
  })
})

describe('readOperand', () => {
  it('accepts decimal and binary in either signedness', () => {
    assert.equal(readOperand({ format: 'decimal', text: '-9' }, 8, true, 'Dividend'), -9n)
    assert.equal(readOperand({ format: 'binary', text: '11110111' }, 8, true, 'Dividend'), -9n)
    assert.equal(readOperand({ format: 'binary', text: '11110111' }, 8, false, 'Dividend'), 247n)
  })

  it('range-checks decimal input against the data size', () => {
    throwsCode(() => readOperand({ format: 'decimal', text: '-1' }, 8, false, 'Divisor'), 'OUT_OF_RANGE')
    throwsCode(() => readOperand({ format: 'decimal', text: '300' }, 8, true, 'Divisor'), 'OUT_OF_RANGE')
  })
})
