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

/** Allows Node.js test runner to serialize BigInts in snapshots */
;(BigInt.prototype as any).toJSON = function () {
  return this.toString() + 'n'
}

/** Asserts that `fn` throws a MachineError carrying the expected code. */
function throwsCode(fn: () => unknown, code: string): void {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof MachineError, `expected MachineError, got ${String(error)}`)
    assert.equal(error.code, code)
    return true
  })
}

describe('data size validation', () => {
  it('accepts the documented range', (t) => {
    t.assert.snapshot(unsignedMax(MIN_BITS))
    t.assert.snapshot(unsignedMax(8))
    t.assert.snapshot(unsignedMax(64))
    t.assert.snapshot(signedMin(64))
    t.assert.snapshot(signedMax(64))
    // "and beyond"
    t.assert.snapshot(unsignedMax(128))
    t.assert.snapshot(signedMax(MAX_BITS))
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
  it('reads signed integers and tolerates separators', (t) => {
    t.assert.snapshot(parseDecimal('42'))
    t.assert.snapshot(parseDecimal('  -7 '))
    t.assert.snapshot(parseDecimal('+9'))
    t.assert.snapshot(parseDecimal('-1,048,576'))
    t.assert.snapshot(parseDecimal('1_000'))
    // Well past Number.MAX_SAFE_INTEGER: exactness is the reason for bigint.
    t.assert.snapshot(parseDecimal('9007199254740993'))
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
  it('normalises to the data size', (t) => {
    t.assert.snapshot(parseBinary('101', 8))
    t.assert.snapshot(parseBinary('0b1010', 8))
    t.assert.snapshot(parseBinary('1010 1100', 8))
    t.assert.snapshot(parseBinary('11111111', 8))
  })

  it('rejects bad digits and oversized literals', () => {
    throwsCode(() => parseBinary('', 8), 'EMPTY_INPUT')
    throwsCode(() => parseBinary('1021', 8), 'INVALID_BINARY')
    throwsCode(() => parseBinary('abc', 8), 'INVALID_BINARY')
    throwsCode(() => parseBinary('101010101', 8), 'BINARY_TOO_LONG')
  })
})

describe('decimal to unsigned binary', () => {
  it('converts in-range values', (t) => {
    t.assert.snapshot(toUnsignedBinary(0n, 2))
    t.assert.snapshot(toUnsignedBinary(3n, 2))
    t.assert.snapshot(toUnsignedBinary(5n, 4))
    t.assert.snapshot(toUnsignedBinary(200n, 8))
    t.assert.snapshot(toUnsignedBinary(255n, 8))
    t.assert.snapshot(toUnsignedBinary(unsignedMax(64), 64))
    t.assert.snapshot(toUnsignedBinary(unsignedMax(100), 100))
  })

  it('rejects out-of-bounds values', () => {
    throwsCode(() => toUnsignedBinary(-1n, 8), 'OUT_OF_RANGE')
    throwsCode(() => toUnsignedBinary(256n, 8), 'OUT_OF_RANGE')
    throwsCode(() => toUnsignedBinary(4n, 2), 'OUT_OF_RANGE')
    throwsCode(() => toUnsignedBinary(1n << 64n, 64), 'OUT_OF_RANGE')
  })
})

describe('decimal to signed binary (two\'s complement)', () => {
  it('converts positive, zero and negative values', (t) => {
    t.assert.snapshot(toSignedBinary(0n, 8))
    t.assert.snapshot(toSignedBinary(5n, 8))
    t.assert.snapshot(toSignedBinary(-5n, 8))
    t.assert.snapshot(toSignedBinary(-1n, 8))
    t.assert.snapshot(toSignedBinary(127n, 8))
    t.assert.snapshot(toSignedBinary(-128n, 8))
    t.assert.snapshot(toSignedBinary(1n, 2))
    t.assert.snapshot(toSignedBinary(-2n, 2))
  })

  it('handles the asymmetric edges of wide words', (t) => {
    t.assert.snapshot(toSignedBinary(signedMin(64), 64))
    t.assert.snapshot(toSignedBinary(signedMax(64), 64))
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
  it('shows magnitude, inversion and increment', (t) => {
    t.assert.snapshot(twosComplementSteps(-5n, 8))
    // The most negative value is its own two's complement.
    t.assert.snapshot(twosComplementSteps(-128n, 8))
  })

  it('is null for non-negative values', (t) => {
    t.assert.snapshot(twosComplementSteps(0n, 8))
    t.assert.snapshot(twosComplementSteps(7n, 8))
  })
})

describe('bit helpers', () => {
  it('wraps values into a fixed width', (t) => {
    t.assert.snapshot(wrapToBits(-1n, 6))
    t.assert.snapshot(wrapToBits(-3n, 6))
    t.assert.snapshot(wrapToBits(5n, 6))
  })

  it('reads two\'s complement back', (t) => {
    t.assert.snapshot(bitsToSigned('111101'))
    t.assert.snapshot(bitsToSigned('000101'))
  })

  it('groups and hex-formats', (t) => {
    t.assert.snapshot(groupBits('11001000'))
    t.assert.snapshot(groupBits('101010'))
    t.assert.snapshot(toHex('11001000'))
    t.assert.snapshot(toHex('1111'))
  })
})

describe('convertDecimal', () => {
  it('reports both representations for a positive value', (t) => {
    const result = convertDecimal('100', 8)
    t.assert.snapshot(result)
  })

  it('reports unsigned as out of bounds for a negative value', (t) => {
    const result = convertDecimal('-100', 8)
    t.assert.snapshot(result)
  })

  it('reports signed as out of bounds when only unsigned fits', (t) => {
    const result = convertDecimal('200', 8)
    t.assert.snapshot(result)
  })

  it('reports both as out of bounds when the value is far too large', (t) => {
    const result = convertDecimal('1000', 8)
    t.assert.snapshot(result)
  })
})

describe('convertBinary', () => {
  it('reads one pattern under both interpretations', (t) => {
    const result = convertBinary('11111101', 8)
    t.assert.snapshot(result)
  })
})

describe('readOperand', () => {
  it('accepts decimal and binary in either signedness', (t) => {
    t.assert.snapshot(readOperand({ format: 'decimal', text: '-9' }, 8, true, 'Dividend'))
    t.assert.snapshot(readOperand({ format: 'binary', text: '11110111' }, 8, true, 'Dividend'))
    t.assert.snapshot(readOperand({ format: 'binary', text: '11110111' }, 8, false, 'Dividend'))
  })

  it('range-checks decimal input against the data size', () => {
    throwsCode(() => readOperand({ format: 'decimal', text: '-1' }, 8, false, 'Divisor'), 'OUT_OF_RANGE')
    throwsCode(() => readOperand({ format: 'decimal', text: '300' }, 8, true, 'Divisor'), 'OUT_OF_RANGE')
  })
})
