/**
 * Unit tests for the non-restoring divider (Team Member 3).
 *
 * Besides the hand-checked cases from the specification, the suite runs an
 * exhaustive sweep over every 6-bit operand pair in both modes. That is 4,032
 * unsigned and 4,032 signed divisions, each verified against JavaScript's own
 * bigint division and against the trace invariants — a much stronger guarantee
 * than a handful of examples.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { signedMax, signedMin, toSignedBinary, unsignedMax } from '../src/lib/conversion.ts'
import {
  ACC_EXTRA_BITS,
  accumulatorValue,
  divide,
  divideValues,
  formatDivision,
  quotientBitsFromSteps,
  type DivisionMode,
  type DivisionResult,
} from '../src/lib/division.ts'
import { MachineError } from '../src/lib/errors.ts'

/** Asserts that `fn` throws a MachineError carrying the expected code. */
function throwsCode(fn: () => unknown, code: string): void {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof MachineError, `expected MachineError, got ${String(error)}`)
    assert.equal(error.code, code)
    return true
  })
}

/**
 * Checks every structural property a completed division must satisfy:
 * the arithmetic identity, the remainder bound, the trace shape, and the fact
 * that the accumulator never overflows the rendered register width.
 */
function assertConsistent(
  result: DivisionResult,
  dividend: bigint,
  divisor: bigint,
  bits: number,
): void {
  const quotient = BigInt(result.quotient.decimal)
  const remainder = BigInt(result.remainder.decimal)
  const label = `${dividend} / ${divisor} @ ${bits} ${result.mode}`

  // Truncated division, the same definition JavaScript's bigint operators use.
  assert.equal(quotient, dividend / divisor, `quotient of ${label}`)
  assert.equal(remainder, dividend % divisor, `remainder of ${label}`)
  assert.equal(quotient * divisor + remainder, dividend, `identity for ${label}`)

  // |remainder| < |divisor|, and it carries the dividend's sign.
  const absRemainder = remainder < 0n ? -remainder : remainder
  const absDivisor = divisor < 0n ? -divisor : divisor
  assert.ok(absRemainder < absDivisor, `remainder magnitude for ${label}`)
  if (remainder !== 0n) {
    assert.equal(remainder < 0n, dividend < 0n, `remainder sign for ${label}`)
  }

  // One shift and one add/subtract per bit; exactly `bits` quotient bits.
  assert.equal(result.steps.filter((step) => step.kind === 'shift').length, bits)
  assert.equal(result.steps.filter((step) => step.q0 !== null).length, bits)
  assert.ok(result.steps.filter((step) => step.kind === 'restore').length <= 1)
  assert.equal(result.accBits, bits + ACC_EXTRA_BITS)

  // The quotient bits collected down the trace are the quotient magnitude.
  const absQuotient = quotient < 0n ? -quotient : quotient
  assert.equal(
    quotientBitsFromSteps(result),
    absQuotient.toString(2).padStart(bits, '0'),
    `assembled quotient bits for ${label}`,
  )

  // Every rendered accumulator round-trips, i.e. nothing overflowed the width.
  for (const step of result.steps) {
    assert.equal(accumulatorValue(step), step.aValue, `A rendering on step ${step.index}`)
    assert.equal(step.a.length, result.accBits)
    assert.equal(step.q.length, bits)
  }
}

/** Runs a division and asserts every invariant, returning the result. */
function run(dividend: bigint, divisor: bigint, bits: number, mode: DivisionMode): DivisionResult {
  const result = divideValues(dividend, divisor, bits, mode)
  assertConsistent(result, dividend, divisor, bits)
  return result
}

describe('unsigned non-restoring division — normal cases', () => {
  it('divides the textbook example 7 / 2 in 4 bits', () => {
    const result = run(7n, 2n, 4, 'unsigned')
    assert.equal(result.quotient.decimal, '3')
    assert.equal(result.quotient.binary, '0011')
    assert.equal(result.remainder.decimal, '1')
    assert.equal(result.remainder.binary, '0001')
  })

  it('divides 200 / 7 in 8 bits', () => {
    const result = run(200n, 7n, 8, 'unsigned')
    assert.equal(result.quotient.decimal, '28')
    assert.equal(result.remainder.decimal, '4')
    assert.equal(result.summary, '200 / 7 = 28 remainder 4')
  })

  it('divides exactly, leaving no remainder', () => {
    const result = run(144n, 12n, 8, 'unsigned')
    assert.equal(result.quotient.decimal, '12')
    assert.equal(result.remainder.decimal, '0')
  })
})

describe('unsigned non-restoring division — special and edge cases', () => {
  it('handles a zero dividend', () => {
    const result = run(0n, 5n, 8, 'unsigned')
    assert.equal(result.quotient.decimal, '0')
    assert.equal(result.remainder.decimal, '0')
  })

  it('handles a divisor larger than the dividend', () => {
    const result = run(3n, 200n, 8, 'unsigned')
    assert.equal(result.quotient.decimal, '0')
    assert.equal(result.remainder.decimal, '3')
  })

  it('handles division by one', () => {
    const result = run(255n, 1n, 8, 'unsigned')
    assert.equal(result.quotient.decimal, '255')
    assert.equal(result.remainder.decimal, '0')
  })

  it('handles equal operands', () => {
    const result = run(97n, 97n, 8, 'unsigned')
    assert.equal(result.quotient.decimal, '1')
    assert.equal(result.remainder.decimal, '0')
  })

  it('handles the widest operands at the smallest data size', () => {
    const result = run(3n, 1n, 2, 'unsigned')
    assert.equal(result.quotient.decimal, '3')
    assert.equal(result.remainder.decimal, '0')
  })

  it('handles the all-ones dividend and divisor, where A needs its guard bit', () => {
    const result = run(unsignedMax(8), unsignedMax(8) - 1n, 8, 'unsigned')
    assert.equal(result.quotient.decimal, '1')
    assert.equal(result.remainder.decimal, '1')
  })

  it('rejects a zero divisor', () => {
    throwsCode(() => divideValues(10n, 0n, 8, 'unsigned'), 'DIVIDE_BY_ZERO')
  })

  it('rejects operands that do not fit the data size', () => {
    throwsCode(() => divideValues(256n, 2n, 8, 'unsigned'), 'OUT_OF_RANGE')
    throwsCode(() => divideValues(-1n, 2n, 8, 'unsigned'), 'OUT_OF_RANGE')
  })
})

describe('signed non-restoring division', () => {
  it('covers all four sign combinations', () => {
    assert.equal(run(17n, 5n, 8, 'signed').summary, '17 / 5 = 3 remainder 2')
    assert.equal(run(-17n, 5n, 8, 'signed').summary, '-17 / 5 = -3 remainder -2')
    assert.equal(run(17n, -5n, 8, 'signed').summary, '17 / -5 = -3 remainder 2')
    assert.equal(run(-17n, -5n, 8, 'signed').summary, '-17 / -5 = 3 remainder -2')
  })

  it('renders negative results in two\'s complement', () => {
    const result = run(-17n, 5n, 8, 'signed')
    assert.equal(result.quotient.binary, toSignedBinary(-3n, 8))
    assert.equal(result.remainder.binary, toSignedBinary(-2n, 8))
    assert.ok(result.signs !== null)
    assert.equal(result.signs.quotientNegative, true)
    assert.deepEqual(result.signs.magnitudes, { dividend: '17', divisor: '5' })
  })

  it('divides the most negative value by one', () => {
    const result = run(signedMin(8), 1n, 8, 'signed')
    assert.equal(result.quotient.decimal, '-128')
    assert.equal(result.remainder.decimal, '0')
  })

  it('reports overflow for the most negative value divided by -1', () => {
    throwsCode(() => divideValues(signedMin(8), -1n, 8, 'signed'), 'DIVIDE_OVERFLOW')
    throwsCode(() => divideValues(signedMin(2), -1n, 2, 'signed'), 'DIVIDE_OVERFLOW')
  })

  it('rejects operands outside the signed range', () => {
    throwsCode(() => divideValues(128n, 2n, 8, 'signed'), 'OUT_OF_RANGE')
    throwsCode(() => divideValues(-129n, 2n, 8, 'signed'), 'OUT_OF_RANGE')
  })
})

describe('wide data sizes', () => {
  it('divides 64-bit operands exactly', () => {
    const dividend = unsignedMax(64)
    const result = run(dividend, 1_000_000_007n, 64, 'unsigned')
    assert.equal(result.steps.filter((step) => step.kind === 'shift').length, 64)
    assert.equal(BigInt(result.quotient.decimal), dividend / 1_000_000_007n)
  })

  it('divides beyond 64 bits', () => {
    const dividend = (1n << 127n) - 1n
    run(dividend, 123_456_789n, 128, 'unsigned')
    run(signedMin(96) + 1n, -7n, 96, 'signed')
  })
})

describe('operand input handling', () => {
  it('accepts decimal and binary operands interchangeably', () => {
    const fromDecimal = divide({
      dividend: { format: 'decimal', text: '200' },
      divisor: { format: 'decimal', text: '7' },
      bits: 8,
      mode: 'unsigned',
    })
    const fromBinary = divide({
      dividend: { format: 'binary', text: '11001000' },
      divisor: { format: 'binary', text: '00000111' },
      bits: 8,
      mode: 'unsigned',
    })
    const mixed = divide({
      dividend: { format: 'binary', text: '1100 1000' },
      divisor: { format: 'decimal', text: '7' },
      bits: 8,
      mode: 'unsigned',
    })
    assert.equal(fromDecimal.summary, '200 / 7 = 28 remainder 4')
    assert.equal(fromBinary.summary, fromDecimal.summary)
    assert.equal(mixed.summary, fromDecimal.summary)
    assert.deepEqual(fromBinary.steps, fromDecimal.steps)
  })

  it('reads a binary operand as negative in signed mode', () => {
    const result = divide({
      dividend: { format: 'binary', text: '11101111' }, // -17
      divisor: { format: 'decimal', text: '5' },
      bits: 8,
      mode: 'signed',
    })
    assert.equal(result.summary, '-17 / 5 = -3 remainder -2')
  })

  it('surfaces malformed operands', () => {
    throwsCode(
      () =>
        divide({
          dividend: { format: 'binary', text: '10201' },
          divisor: { format: 'decimal', text: '5' },
          bits: 8,
          mode: 'unsigned',
        }),
      'INVALID_BINARY',
    )
    throwsCode(
      () =>
        divide({
          dividend: { format: 'decimal', text: '10' },
          divisor: { format: 'decimal', text: '0' },
          bits: 8,
          mode: 'unsigned',
        }),
      'DIVIDE_BY_ZERO',
    )
  })
})

describe('step-by-step trace', () => {
  it('follows the documented register sequence for 7 / 2 in 4 bits', () => {
    const result = divideValues(7n, 2n, 4, 'unsigned')
    // A is shown in 6 bits (4 data bits + guard + sign).
    const trace = result.steps.map((step) => `${step.action} A=${step.a} Q=${step.q}`)
    assert.deepEqual(trace, [
      'Initialise A=000000 Q=0111',
      'Shift left [A,Q] A=000000 Q=1110',
      'A <- A - M A=111110 Q=1110',
      'Shift left [A,Q] A=111101 Q=1100',
      'A <- A + M A=111111 Q=1100',
      'Shift left [A,Q] A=111111 Q=1000',
      'A <- A + M A=000001 Q=1001',
      'Shift left [A,Q] A=000011 Q=0010',
      'A <- A - M A=000001 Q=0011',
    ])
    assert.equal(quotientBitsFromSteps(result), '0011')
  })

  it('records the final restore only when the loop ends negative', () => {
    // 1 / 3: every subtraction overshoots, so A ends negative and is restored.
    const restored = run(1n, 3n, 4, 'unsigned')
    assert.equal(restored.steps.filter((step) => step.kind === 'restore').length, 1)
    assert.equal(restored.remainder.decimal, '1')

    // 7 / 2 ends with A = +1, so no correction is needed. (An exact division is
    // *not* a guarantee: 8 / 4 also ends negative and does need the restore.)
    const noRestore = run(7n, 2n, 4, 'unsigned')
    assert.equal(noRestore.steps.filter((step) => step.kind === 'restore').length, 0)
  })

  it('formats a readable table', () => {
    const text = formatDivision(divideValues(200n, 7n, 8, 'unsigned'))
    assert.match(text, /unsigned division, 8-bit operands/)
    assert.match(text, /Quotient : 28 \(00011100\)/)
    assert.match(text, /Check    : \(28 x 7\) \+ 4 = 200 = 200/)
  })
})

describe('exhaustive sweep', () => {
  it('matches bigint division for every 6-bit unsigned pair', () => {
    const max = Number(unsignedMax(6))
    for (let dividend = 0; dividend <= max; dividend++) {
      for (let divisor = 1; divisor <= max; divisor++) {
        run(BigInt(dividend), BigInt(divisor), 6, 'unsigned')
      }
    }
  })

  it('matches bigint division for every 6-bit signed pair', () => {
    const low = Number(signedMin(6))
    const high = Number(signedMax(6))
    for (let dividend = low; dividend <= high; dividend++) {
      for (let divisor = low; divisor <= high; divisor++) {
        if (divisor === 0) continue
        // The single representable overflow: -32 / -1 = 32 needs 7 bits.
        if (dividend === low && divisor === -1) {
          throwsCode(() => divideValues(BigInt(dividend), -1n, 6, 'signed'), 'DIVIDE_OVERFLOW')
          continue
        }
        run(BigInt(dividend), BigInt(divisor), 6, 'signed')
      }
    }
  })
})
