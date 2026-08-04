/**
 * Machine 1 — Part 2a: Sequential circuit binary multiplication.
 *
 * Responsibilities covered here (Team Member 2):
 *   - The sequential (add-and-shift) circuit multiplier over any register width
 *   - Decimal or binary operands (decimal is converted internally)
 *   - A full step-by-step trace of every register state
 *   - Final 2n-bit product, in decimal and binary
 *
 * ---------------------------------------------------------------------------
 * The algorithm
 * ---------------------------------------------------------------------------
 * Registers: A (accumulator, n bits), Q (holds the multiplier, n bits),
 * M (the multiplicand, n bits) and C, a single carry flip-flop.
 *
 *   A <- 0, C <- 0, Q <- multiplier, M <- multiplicand, repeat n times:
 *     1. examine Q0, the low bit of Q
 *        if Q0 = 1:  C,A <- A + M      (carry out lands in C)
 *        if Q0 = 0:  no operation
 *     2. shift the triple [C,A,Q] one place right:
 *        C -> A's MSB, A's LSB -> Q's MSB, Q0 falls off the end; C <- 0
 *   the product is the 2n-bit pair A:Q
 *
 * This is long multiplication done in hardware. Each iteration handles one bit
 * of the multiplier: where the paper method writes a shifted partial product
 * and adds everything at the end, the circuit adds M into A immediately and
 * then shifts the accumulated total right — which is the same as shifting the
 * next partial product left, but keeps the adder only n bits wide.
 *
 * Q does double duty, which is the trick that makes the circuit cheap: it is
 * consumed one bit at a time from the right while the low half of the product
 * is shifted in from the left, so after n iterations the multiplier is gone and
 * A:Q holds the full 2n-bit product with no extra register.
 *
 * The carry flip-flop C is needed because A + M can overflow n bits. It holds
 * that carry for exactly one moment — until the shift moves it into A's MSB —
 * and is cleared immediately afterwards.
 *
 * ---------------------------------------------------------------------------
 * Signed operands
 * ---------------------------------------------------------------------------
 * The sequential circuit multiplies unsigned magnitudes. As with the divider,
 * signed operands are handled by multiplying |a| x |b| and then applying the
 * sign: the product is negative when the operand signs differ. (Booth's
 * algorithm is the alternative that handles two's complement directly; the
 * specification asks for the sequential circuit multiplier, so the sign is
 * applied separately here.)
 */

import {
  assertValidBits,
  describeRange,
  makeView,
  rangeOf,
  readOperand,
  wrapToBits,
  type OperandInput,
  type ValueView,
} from './conversion.ts'
import { MachineError } from './errors.ts'

/** Interpretation applied to both operands. */
export type MultiplicationMode = 'unsigned' | 'signed'

/** What kind of trace row this is, so the GUI can style it. */
export type MultiplicationStepKind =
  | 'init' // initial register load
  | 'add' // Q0 was 1: C,A <- A + M
  | 'skip' // Q0 was 0: no addition this iteration
  | 'shift' // right shift of the [C,A,Q] triple
  | 'result' // sign fix-up / final answer

/** One row of the step-by-step solution. */
export type MultiplicationStep = {
  /** 1-based row number across the whole trace. */
  index: number
  /** Loop iteration this row belongs to; 0 for setup and final rows. */
  iteration: number
  kind: MultiplicationStepKind
  /** Short description of the operation, e.g. "C,A <- A + M". */
  action: string
  /** Carry flip-flop, '0' or '1'. */
  c: string
  /** Accumulator, rendered in `bits` bits. */
  a: string
  /** Q register, rendered in `bits` bits. */
  q: string
  /** Multiplicand register (never changes), rendered in `bits` bits. */
  m: string
  /** The multiplier bit this iteration examined; null on setup/final rows. */
  q0: 0 | 1 | null
  /** Plain-language explanation of why this row happened. */
  note: string
}

/** Sign bookkeeping for signed multiplication; `null` in unsigned mode. */
export type MultiplicationSignInfo = {
  multiplicandNegative: boolean
  multiplierNegative: boolean
  productNegative: boolean
  /** The magnitudes that were actually fed to the loop. */
  magnitudes: { multiplicand: string; multiplier: string }
}

/** Everything the GUI needs to render a completed multiplication. */
export type MultiplicationResult = {
  mode: MultiplicationMode
  bits: number
  /** Width of the product register pair A:Q, always `bits * 2`. */
  productBits: number
  multiplicand: ValueView
  multiplier: ValueView
  product: ValueView
  steps: MultiplicationStep[]
  signs: MultiplicationSignInfo | null
  /** One-line summary, e.g. "-5 x 3 = -15". */
  summary: string
  /** The product split into its two register halves, for display. */
  halves: { a: string; q: string }
}

// ---------------------------------------------------------------------------
// Core algorithm
// ---------------------------------------------------------------------------

/**
 * Runs the sequential circuit multiplier on two already-validated values.
 *
 * Prefer `multiply()` for input coming from the GUI; this entry point exists so
 * the algorithm can be tested directly with `bigint`s.
 *
 * @param multiplicandValue Multiplicand (loaded into M).
 * @param multiplierValue   Multiplier (loaded into Q).
 * @param bits              Data size of the operand registers.
 * @param mode              How both operands are interpreted.
 */
export function multiplyValues(
  multiplicandValue: bigint,
  multiplierValue: bigint,
  bits: number,
  mode: MultiplicationMode,
): MultiplicationResult {
  assertValidBits(bits)
  const signed = mode === 'signed'
  const range = rangeOf(bits, signed)

  // --- Guard rails -------------------------------------------------------
  for (const [label, value] of [
    ['Multiplicand', multiplicandValue],
    ['Multiplier', multiplierValue],
  ] as const) {
    if (value < range.min || value > range.max) {
      throw new MachineError(
        'OUT_OF_RANGE',
        `${label} ${value} does not fit in ${bits} ${mode} bits (range ${describeRange(range)}).`,
      )
    }
  }

  // --- Sign handling: the loop below only ever sees magnitudes -----------
  const multiplicandNegative = multiplicandValue < 0n
  const multiplierNegative = multiplierValue < 0n
  const multiplicandMagnitude = multiplicandNegative ? -multiplicandValue : multiplicandValue
  const multiplierMagnitude = multiplierNegative ? -multiplierValue : multiplierValue

  const productBits = bits * 2
  const mask = (1n << BigInt(bits)) - 1n

  const steps: MultiplicationStep[] = []
  let a = 0n // accumulator: the running high half of the product
  let c = 0n // carry flip-flop
  let q = multiplierMagnitude & mask // multiplier, consumed one bit per pass
  const m = multiplicandMagnitude & mask

  const push = (
    iteration: number,
    kind: MultiplicationStepKind,
    action: string,
    q0: 0 | 1 | null,
    note: string,
  ): void => {
    steps.push({
      index: steps.length + 1,
      iteration,
      kind,
      action,
      c: c.toString(),
      a: wrapToBits(a, bits),
      q: wrapToBits(q, bits),
      m: wrapToBits(m, bits),
      q0,
      note,
    })
  }

  push(
    0,
    'init',
    'Initialise',
    null,
    `A and C are cleared, Q holds the multiplier magnitude ${multiplierMagnitude}, M holds the multiplicand magnitude ${multiplicandMagnitude}. The loop runs ${bits} times, once per bit of the multiplier.`,
  )

  // --- Main loop: one iteration per bit of the multiplier -----------------
  for (let iteration = 1; iteration <= bits; iteration++) {
    const q0: 0 | 1 = (q & 1n) === 1n ? 1 : 0

    // Step 1: add the multiplicand only when this multiplier bit is set.
    if (q0 === 1) {
      const sum = a + m
      // The adder is n bits wide; anything above that is the carry out.
      c = sum >> BigInt(bits)
      a = sum & mask
      push(
        iteration,
        'add',
        'C,A <- A + M',
        q0,
        `Q0 = 1, so the multiplicand is added into the accumulator.${
          c === 1n ? ' The addition overflowed n bits, so the carry is held in C.' : ''
        }`,
      )
    } else {
      push(
        iteration,
        'skip',
        'No operation',
        q0,
        'Q0 = 0, so this partial product is zero and nothing is added.',
      )
    }

    // Step 2: shift [C,A,Q] right by one. C fills A's MSB, A's LSB fills Q's
    // MSB, and the multiplier bit just consumed falls off the end of Q.
    const bitLeavingA = a & 1n
    q = (q >> 1n) | (bitLeavingA << BigInt(bits - 1))
    a = (a >> 1n) | (c << BigInt(bits - 1))
    c = 0n
    push(
      iteration,
      'shift',
      'Shift right [C,A,Q]',
      q0,
      `C moves into A's MSB, A's LSB (${bitLeavingA}) moves into Q's MSB, and the used multiplier bit drops off. C is cleared.`,
    )
  }

  // --- Re-apply the operand signs ----------------------------------------
  const productNegative = multiplicandNegative !== multiplierNegative
  // The product is the register pair A:Q read as one 2n-bit number.
  const productMagnitude = (a << BigInt(bits)) | q
  const productValue = productNegative ? -productMagnitude : productMagnitude

  if (signed) {
    push(
      0,
      'result',
      'Apply sign',
      null,
      `Product magnitude ${productMagnitude} takes the ${productNegative ? 'negative' : 'positive'} sign, because the operand signs ${productNegative ? 'differ' : 'match'}.`,
    )
  }

  // A 2n-bit field always holds the product of two n-bit operands, so no
  // overflow check is needed here — unlike division, where -2^(n-1) / -1 can
  // exceed the field. The widest signed case, (-2^(n-1)) x (-2^(n-1)) =
  // 2^(2n-2), still fits the 2n-bit signed range.
  const view = (value: bigint): ValueView => makeView(value, productBits, signed)

  return {
    mode,
    bits,
    productBits,
    multiplicand: makeView(multiplicandValue, bits, signed),
    multiplier: makeView(multiplierValue, bits, signed),
    product: view(productValue),
    steps,
    signs: signed
      ? {
          multiplicandNegative,
          multiplierNegative,
          productNegative,
          magnitudes: {
            multiplicand: multiplicandMagnitude.toString(),
            multiplier: multiplierMagnitude.toString(),
          },
        }
      : null,
    summary: `${multiplicandValue} x ${multiplierValue} = ${productValue}`,
    halves: { a: wrapToBits(a, bits), q: wrapToBits(q, bits) },
  }
}

/** Operands and settings as they arrive from the GUI. */
export type MultiplicationRequest = {
  multiplicand: OperandInput
  multiplier: OperandInput
  bits: number
  mode: MultiplicationMode
}

/**
 * GUI entry point: parses both operands (decimal or binary, in either field)
 * and runs the multiplication.
 *
 * Throws a `MachineError` for any bad input — malformed literal, or a value
 * that does not fit the data size.
 */
export function multiply(request: MultiplicationRequest): MultiplicationResult {
  const { multiplicand, multiplier, bits, mode } = request
  assertValidBits(bits)
  const signed = mode === 'signed'
  const multiplicandValue = readOperand(multiplicand, bits, signed, 'Multiplicand')
  const multiplierValue = readOperand(multiplier, bits, signed, 'Multiplier')
  return multiplyValues(multiplicandValue, multiplierValue, bits, mode)
}

// ---------------------------------------------------------------------------
// Plain-text rendering (console output, tests, README examples)
// ---------------------------------------------------------------------------

/** Renders a completed multiplication as a monospaced table. */
export function formatMultiplication(result: MultiplicationResult): string {
  const header = ['#', 'It', 'Operation', 'C', 'A'.padEnd(result.bits), 'Q'.padEnd(result.bits)]
  const rows = result.steps.map((step) => [
    String(step.index),
    step.iteration === 0 ? '-' : String(step.iteration),
    step.action,
    step.c,
    step.a,
    step.q,
  ])

  const widths = header.map((cell, column) =>
    Math.max(cell.length, ...rows.map((row) => row[column].length)),
  )
  const line = (cells: string[]): string =>
    cells.map((cell, column) => cell.padEnd(widths[column])).join('  ').trimEnd()

  return [
    `${result.mode} multiplication, ${result.bits}-bit operands`,
    `Multiplicand M: ${result.multiplicand.decimal} (${result.multiplicand.binary})`,
    `Multiplier   Q: ${result.multiplier.decimal} (${result.multiplier.binary})`,
    '',
    line(header),
    line(widths.map((width) => '-'.repeat(width))),
    ...rows.map(line),
    '',
    `Product: ${result.product.decimal} (${result.product.binary})`,
    `A:Q    : ${result.halves.a} ${result.halves.q}`,
  ].join('\n')
}
