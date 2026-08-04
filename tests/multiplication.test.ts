/**
 * Unit tests for the sequential circuit multiplier (Team Member 2).
 *
 * As with the divider, the hand-checked cases are backed by an exhaustive
 * sweep: every 6-bit operand pair in both modes, checked against bigint
 * multiplication and against the trace invariants.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { signedMax, signedMin, unsignedMax } from '../src/lib/conversion.ts'
import { MachineError } from '../src/lib/errors.ts'
import {
  formatMultiplication,
  multiply,
  multiplyValues,
  type MultiplicationMode,
  type MultiplicationResult,
} from '../src/lib/multiplication.ts'

/** Asserts that `fn` throws a MachineError carrying the expected code. */
function throwsCode(fn: () => unknown, code: string): void {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof MachineError, `expected MachineError, got ${String(error)}`)
    assert.equal(error.code, code)
    return true
  })
}

/** Checks every structural property a completed multiplication must satisfy. */
function assertConsistent(
  result: MultiplicationResult,
  multiplicand: bigint,
  multiplier: bigint,
  bits: number,
): void {
  const product = BigInt(result.product.decimal)
  const label = `${multiplicand} x ${multiplier} @ ${bits} ${result.mode}`

  assert.equal(product, multiplicand * multiplier, `product of ${label}`)

  // One add-or-skip row and one shift row per bit of the multiplier.
  assert.equal(
    result.steps.filter((step) => step.kind === 'add' || step.kind === 'skip').length,
    bits,
  )
  assert.equal(result.steps.filter((step) => step.kind === 'shift').length, bits)
  assert.equal(result.productBits, bits * 2)

  // The product register pair A:Q holds the magnitude at the end.
  const absProduct = product < 0n ? -product : product
  assert.equal(
    `${result.halves.a}${result.halves.q}`,
    absProduct.toString(2).padStart(bits * 2, '0'),
    `A:Q halves for ${label}`,
  )

  // Registers are always rendered at their declared widths, and the carry
  // flip-flop is always cleared by the end of an iteration.
  for (const step of result.steps) {
    assert.equal(step.a.length, bits)
    assert.equal(step.q.length, bits)
    assert.ok(step.c === '0' || step.c === '1')
    if (step.kind === 'shift') assert.equal(step.c, '0', 'C cleared after shift')
  }
}

/** Runs a multiplication and asserts every invariant, returning the result. */
function run(
  multiplicand: bigint,
  multiplier: bigint,
  bits: number,
  mode: MultiplicationMode,
): MultiplicationResult {
  const result = multiplyValues(multiplicand, multiplier, bits, mode)
  assertConsistent(result, multiplicand, multiplier, bits)
  return result
}

describe('sequential multiplier — normal cases', () => {
  it('multiplies the textbook example 5 x 3 in 4 bits', () => {
    const result = run(5n, 3n, 4, 'unsigned')
    assert.equal(result.product.decimal, '15')
    assert.equal(result.product.binary, '00001111')
    assert.deepEqual(result.halves, { a: '0000', q: '1111' })
  })

  it('multiplies 13 x 11 in 8 bits', () => {
    const result = run(13n, 11n, 8, 'unsigned')
    assert.equal(result.product.decimal, '143')
    assert.equal(result.summary, '13 x 11 = 143')
  })

  it('multiplies the largest 8-bit operands', () => {
    const result = run(255n, 255n, 8, 'unsigned')
    assert.equal(result.product.decimal, '65025')
    assert.equal(result.product.binary, '1111111000000001') // 0xFE01
  })
})

describe('sequential multiplier — special and edge cases', () => {
  it('handles a zero operand', () => {
    assert.equal(run(0n, 200n, 8, 'unsigned').product.decimal, '0')
    assert.equal(run(200n, 0n, 8, 'unsigned').product.decimal, '0')
  })

  it('handles multiplication by one', () => {
    assert.equal(run(1n, 173n, 8, 'unsigned').product.decimal, '173')
    assert.equal(run(173n, 1n, 8, 'unsigned').product.decimal, '173')
  })

  it('handles powers of two, where every iteration but one is a skip', () => {
    const result = run(1n, 128n, 8, 'unsigned')
    assert.equal(result.product.decimal, '128')
    assert.equal(result.steps.filter((step) => step.kind === 'add').length, 1)
    assert.equal(result.steps.filter((step) => step.kind === 'skip').length, 7)
  })

  it('handles the all-ones multiplier, where every iteration adds', () => {
    const result = run(200n, 255n, 8, 'unsigned')
    assert.equal(result.steps.filter((step) => step.kind === 'add').length, 8)
    assert.equal(result.product.decimal, '51000')
  })

  it('handles the smallest data size', () => {
    assert.equal(run(3n, 3n, 2, 'unsigned').product.decimal, '9')
    assert.equal(run(3n, 3n, 2, 'unsigned').product.binary, '1001')
  })

  it('rejects operands that do not fit the data size', () => {
    throwsCode(() => multiplyValues(256n, 2n, 8, 'unsigned'), 'OUT_OF_RANGE')
    throwsCode(() => multiplyValues(-1n, 2n, 8, 'unsigned'), 'OUT_OF_RANGE')
  })
})

describe('signed multiplication', () => {
  it('covers all four sign combinations', () => {
    assert.equal(run(5n, 3n, 8, 'signed').summary, '5 x 3 = 15')
    assert.equal(run(-5n, 3n, 8, 'signed').summary, '-5 x 3 = -15')
    assert.equal(run(5n, -3n, 8, 'signed').summary, '5 x -3 = -15')
    assert.equal(run(-5n, -3n, 8, 'signed').summary, '-5 x -3 = 15')
  })

  it('renders a negative product in two\'s complement', () => {
    const result = run(-5n, 3n, 8, 'signed')
    // -15 in 16 bits (the product field is 2n bits wide).
    assert.equal(result.product.binary, '1111111111110001')
    assert.ok(result.signs !== null)
    assert.equal(result.signs.productNegative, true)
    assert.deepEqual(result.signs.magnitudes, { multiplicand: '5', multiplier: '3' })
  })

  it('handles the most negative operands, the widest signed product', () => {
    const result = run(signedMin(8), signedMin(8), 8, 'signed')
    assert.equal(result.product.decimal, '16384') // (-128)^2 fits 16 signed bits
    assert.equal(run(signedMin(8), 1n, 8, 'signed').product.decimal, '-128')
    assert.equal(run(signedMin(8), -1n, 8, 'signed').product.decimal, '128')
  })

  it('rejects operands outside the signed range', () => {
    throwsCode(() => multiplyValues(128n, 2n, 8, 'signed'), 'OUT_OF_RANGE')
    throwsCode(() => multiplyValues(-129n, 2n, 8, 'signed'), 'OUT_OF_RANGE')
  })
})

describe('wide data sizes', () => {
  it('multiplies 64-bit operands exactly', () => {
    const result = run(unsignedMax(64), unsignedMax(64), 64, 'unsigned')
    assert.equal(BigInt(result.product.decimal), unsignedMax(64) * unsignedMax(64))
    assert.equal(result.productBits, 128)
  })

  it('multiplies beyond 64 bits', () => {
    run((1n << 127n) - 1n, 987_654_321n, 128, 'unsigned')
    run(signedMin(96), -7n, 96, 'signed')
  })
})

describe('operand input handling', () => {
  it('accepts decimal and binary operands interchangeably', () => {
    const fromDecimal = multiply({
      multiplicand: { format: 'decimal', text: '13' },
      multiplier: { format: 'decimal', text: '11' },
      bits: 8,
      mode: 'unsigned',
    })
    const fromBinary = multiply({
      multiplicand: { format: 'binary', text: '00001101' },
      multiplier: { format: 'binary', text: '0000 1011' },
      bits: 8,
      mode: 'unsigned',
    })
    assert.equal(fromDecimal.summary, '13 x 11 = 143')
    assert.deepEqual(fromBinary.steps, fromDecimal.steps)
  })

  it('reads a binary operand as negative in signed mode', () => {
    const result = multiply({
      multiplicand: { format: 'binary', text: '11111011' }, // -5
      multiplier: { format: 'decimal', text: '3' },
      bits: 8,
      mode: 'signed',
    })
    assert.equal(result.summary, '-5 x 3 = -15')
  })

  it('surfaces malformed operands', () => {
    throwsCode(
      () =>
        multiply({
          multiplicand: { format: 'binary', text: '12' },
          multiplier: { format: 'decimal', text: '3' },
          bits: 8,
          mode: 'unsigned',
        }),
      'INVALID_BINARY',
    )
  })
})

describe('step-by-step trace', () => {
  it('follows the documented register sequence for 5 x 3 in 4 bits', () => {
    const result = multiplyValues(5n, 3n, 4, 'unsigned')
    const trace = result.steps.map((step) => `${step.action} C=${step.c} A=${step.a} Q=${step.q}`)
    assert.deepEqual(trace, [
      'Initialise C=0 A=0000 Q=0011',
      'C,A <- A + M C=0 A=0101 Q=0011',
      'Shift right [C,A,Q] C=0 A=0010 Q=1001',
      'C,A <- A + M C=0 A=0111 Q=1001',
      'Shift right [C,A,Q] C=0 A=0011 Q=1100',
      'No operation C=0 A=0011 Q=1100',
      'Shift right [C,A,Q] C=0 A=0001 Q=1110',
      'No operation C=0 A=0001 Q=1110',
      'Shift right [C,A,Q] C=0 A=0000 Q=1111',
    ])
  })

  it('records the carry flip-flop when an addition overflows', () => {
    // 15 x 15 in 4 bits: A + M overflows 4 bits, so C must catch the carry.
    const result = run(15n, 15n, 4, 'unsigned')
    assert.equal(result.product.decimal, '225')
    assert.ok(
      result.steps.some((step) => step.kind === 'add' && step.c === '1'),
      'expected at least one addition to set the carry',
    )
  })

  it('formats a readable table', () => {
    const text = formatMultiplication(multiplyValues(13n, 11n, 8, 'unsigned'))
    assert.match(text, /unsigned multiplication, 8-bit operands/)
    assert.match(text, /Product: 143 \(0000000010001111\)/)
  })
})

describe('exhaustive sweep', () => {
  it('matches bigint multiplication for every 6-bit unsigned pair', () => {
    const max = Number(unsignedMax(6))
    for (let left = 0; left <= max; left++) {
      for (let right = 0; right <= max; right++) {
        run(BigInt(left), BigInt(right), 6, 'unsigned')
      }
    }
  })

  it('matches bigint multiplication for every 6-bit signed pair', () => {
    const low = Number(signedMin(6))
    const high = Number(signedMax(6))
    for (let left = low; left <= high; left++) {
      for (let right = low; right <= high; right++) {
        run(BigInt(left), BigInt(right), 6, 'signed')
      }
    }
  })
})
