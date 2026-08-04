/**
 * Machine 1 — Part 2b: Non-restoring binary division.
 *
 * Responsibilities covered here (Team Member 3):
 *   - The non-restoring division algorithm over registers of any width
 *   - Decimal or binary operands (decimal is converted internally, never
 *     divided as a JavaScript number)
 *   - A full step-by-step trace of every register state
 *   - Final quotient and remainder, in decimal and binary
 *
 * ---------------------------------------------------------------------------
 * The algorithm
 * ---------------------------------------------------------------------------
 * Registers: A (accumulator / partial remainder), Q (holds the dividend, and
 * fills up with the quotient as the division proceeds) and M (the divisor).
 *
 *   A <- 0, Q <- dividend, M <- divisor, repeat n times:
 *     1. shift the pair [A,Q] one place left  (Q's MSB moves into A's LSB)
 *     2. if A was negative  ->  A <- A + M
 *        else                  A <- A - M
 *     3. Q0 <- 1 if A is now non-negative, else Q0 <- 0
 *   after the loop: if A is negative, A <- A + M   (single final restore)
 *   quotient = Q, remainder = A
 *
 * The name comes from step 2: a *restoring* divider that subtracts too much
 * must immediately add M back before it can continue, costing an extra cycle.
 * A non-restoring divider instead leaves A negative and *adds* on the next
 * iteration, which is algebraically identical (2(A + M) - M == 2A + M) but
 * needs one add/subtract per bit instead of up to two. Only one corrective
 * addition can ever be required, and it happens once, at the very end.
 *
 * ---------------------------------------------------------------------------
 * Accumulator width
 * ---------------------------------------------------------------------------
 * Between iterations the invariant is -M <= A < M. Step 1 doubles A before
 * step 2 restores the invariant, so the trace has to display values in
 * [-2M, 2M - 1]. With M as large as 2^n - 1, a two's-complement register needs
 * n + 2 bits to hold that range without overflow: n magnitude bits, one guard
 * bit for the doubling, one sign bit. `ACC_EXTRA_BITS` below encodes that.
 * Arithmetic itself is exact `bigint`; the extra width only affects how A is
 * rendered, but rendering it too narrowly would show wrapped, wrong-looking
 * bit patterns in the trace.
 *
 * ---------------------------------------------------------------------------
 * Signed operands
 * ---------------------------------------------------------------------------
 * Non-restoring division is defined on unsigned magnitudes. Signed division is
 * therefore done the way hardware does it: divide |dividend| by |divisor|, then
 * apply the signs. The quotient is negative when the operand signs differ, and
 * the remainder always takes the sign of the dividend. That yields truncated
 * (toward-zero) division, matching C, Java and JavaScript, and it keeps the
 * identity quotient * divisor + remainder == dividend true.
 */

import {
  assertValidBits,
  bitsToUnsigned,
  describeRange,
  makeView,
  rangeOf,
  readOperand,
  wrapToBits,
  type OperandInput,
  type ValueView,
} from './conversion.ts'
import { MachineError } from './errors.ts'

/** Extra accumulator bits beyond the data size: one guard bit, one sign bit. */
export const ACC_EXTRA_BITS = 2

/** Interpretation applied to both operands. */
export type DivisionMode = 'unsigned' | 'signed'

/** What kind of trace row this is, so the GUI can style it. */
export type DivisionStepKind =
  | 'init' // initial register load
  | 'shift' // left shift of the [A,Q] pair
  | 'subtract' // A <- A - M
  | 'add' // A <- A + M
  | 'restore' // final corrective addition
  | 'result' // sign fix-up / final answer

/** One row of the step-by-step solution. */
export type DivisionStep = {
  /** 1-based row number across the whole trace. */
  index: number
  /** Loop iteration this row belongs to; 0 for setup and final rows. */
  iteration: number
  kind: DivisionStepKind
  /** Short description of the operation, e.g. "A <- A - M". */
  action: string
  /** Accumulator, rendered in `accBits` two's-complement bits. */
  a: string
  /** Q register, rendered in `bits` bits. */
  q: string
  /** Divisor register (never changes), rendered in `bits` bits. */
  m: string
  /** Signed value of A on this row. */
  aValue: bigint
  /** Unsigned value of Q on this row. */
  qValue: bigint
  /** The bit written into Q0 on this row, when one was written. */
  q0: 0 | 1 | null
  /** Plain-language explanation of why this row happened. */
  note: string
}

/** Sign bookkeeping for signed division; `null` in unsigned mode. */
export type SignInfo = {
  dividendNegative: boolean
  divisorNegative: boolean
  quotientNegative: boolean
  /** |dividend| and |divisor| that were actually fed to the loop. */
  magnitudes: { dividend: string; divisor: string }
}

/** Everything the GUI needs to render a completed division. */
export type DivisionResult = {
  mode: DivisionMode
  bits: number
  /** Width used to render the accumulator: `bits + ACC_EXTRA_BITS`. */
  accBits: number
  dividend: ValueView
  divisor: ValueView
  quotient: ValueView
  remainder: ValueView
  steps: DivisionStep[]
  signs: SignInfo | null
  /** One-line summary, e.g. "-17 / 5 = -3 remainder -2". */
  summary: string
  /** The identity used to verify the answer, spelled out with real numbers. */
  verification: string
}

// ---------------------------------------------------------------------------
// Core algorithm
// ---------------------------------------------------------------------------

/**
 * Runs non-restoring division on two already-validated values.
 *
 * Prefer `divide()` for input coming from the GUI; this entry point exists so
 * the algorithm can be tested directly with `bigint`s and reused by other
 * modules.
 *
 * @param dividendValue Dividend, already known to fit the data size.
 * @param divisorValue  Divisor, already known to fit the data size.
 * @param bits          Data size of the operand registers.
 * @param mode          How both operands are interpreted.
 */
export function divideValues(
  dividendValue: bigint,
  divisorValue: bigint,
  bits: number,
  mode: DivisionMode,
): DivisionResult {
  assertValidBits(bits)
  const signed = mode === 'signed'
  const range = rangeOf(bits, signed)

  // --- Guard rails -------------------------------------------------------
  for (const [label, value] of [
    ['Dividend', dividendValue],
    ['Divisor', divisorValue],
  ] as const) {
    if (value < range.min || value > range.max) {
      throw new MachineError(
        'OUT_OF_RANGE',
        `${label} ${value} does not fit in ${bits} ${mode} bits (range ${describeRange(range)}).`,
      )
    }
  }
  if (divisorValue === 0n) {
    throw new MachineError('DIVIDE_BY_ZERO', 'Cannot divide by zero.')
  }

  // --- Sign handling: the loop below only ever sees magnitudes -----------
  const dividendNegative = dividendValue < 0n
  const divisorNegative = divisorValue < 0n
  const dividendMagnitude = dividendNegative ? -dividendValue : dividendValue
  const divisorMagnitude = divisorNegative ? -divisorValue : divisorValue

  const accBits = bits + ACC_EXTRA_BITS
  const qMask = (1n << BigInt(bits)) - 1n
  const msbMask = 1n << BigInt(bits - 1)

  const steps: DivisionStep[] = []
  let a = 0n // partial remainder (exact, signed)
  let q = dividendMagnitude & qMask // dividend, becomes the quotient
  const m = divisorMagnitude

  const push = (
    iteration: number,
    kind: DivisionStepKind,
    action: string,
    q0: 0 | 1 | null,
    note: string,
  ): void => {
    steps.push({
      index: steps.length + 1,
      iteration,
      kind,
      action,
      a: wrapToBits(a, accBits),
      q: wrapToBits(q, bits),
      m: wrapToBits(m, bits),
      aValue: a,
      qValue: q,
      q0,
      note,
    })
  }

  push(
    0,
    'init',
    'Initialise',
    null,
    `A is cleared, Q holds the dividend magnitude ${dividendMagnitude}, M holds the divisor magnitude ${divisorMagnitude}. The loop runs ${bits} times, once per bit of Q.`,
  )

  // --- Main loop: one iteration per bit of the quotient -------------------
  for (let iteration = 1; iteration <= bits; iteration++) {
    const wasNegative = a < 0n

    // Step 1: shift [A,Q] left by one; Q's MSB becomes A's new LSB.
    const carriedBit = (q & msbMask) === 0n ? 0n : 1n
    a = a * 2n + carriedBit
    q = (q << 1n) & qMask
    push(
      iteration,
      'shift',
      'Shift left [A,Q]',
      null,
      `Bit ${carriedBit} shifts out of Q into A. Q0 is left empty for this iteration's quotient bit.`,
    )

    // Step 2: subtract when the previous A was non-negative, add when it was
    // negative. This is the non-restoring decision.
    if (wasNegative) {
      a = a + m
      push(
        iteration,
        'add',
        'A <- A + M',
        null,
        'A was negative before the shift, so M is added back instead of subtracted — this is the deferred restore.',
      )
    } else {
      a = a - m
      push(
        iteration,
        'subtract',
        'A <- A - M',
        null,
        'A was non-negative before the shift, so M is subtracted.',
      )
    }

    // Step 3: the sign of the new A is this iteration's quotient bit.
    const quotientBit: 0 | 1 = a >= 0n ? 1 : 0
    if (quotientBit === 1) q |= 1n
    const last = steps[steps.length - 1]
    last.q0 = quotientBit
    last.q = wrapToBits(q, bits)
    last.qValue = q
    last.note += ` A is now ${a >= 0n ? 'non-negative' : 'negative'}, so Q0 = ${quotientBit}.`
  }

  // --- Final correction: at most one restore is ever needed ---------------
  if (a < 0n) {
    a = a + m
    push(
      0,
      'restore',
      'A <- A + M',
      null,
      'The loop ended with a negative A, so one corrective addition restores the true remainder. This happens at most once in the whole division.',
    )
  }

  // --- Re-apply the operand signs ----------------------------------------
  const quotientNegative = dividendNegative !== divisorNegative
  const quotientMagnitude = q
  const remainderMagnitude = a
  const quotientValue = quotientNegative ? -quotientMagnitude : quotientMagnitude
  const remainderValue = dividendNegative ? -remainderMagnitude : remainderMagnitude

  if (signed) {
    push(
      0,
      'result',
      'Apply signs',
      null,
      `Quotient magnitude ${quotientMagnitude} takes the ${quotientNegative ? 'negative' : 'positive'} sign (operand signs ${quotientNegative ? 'differ' : 'match'}); remainder magnitude ${remainderMagnitude} takes the sign of the dividend.`,
    )
  }

  // The quotient magnitude can exceed the signed range in exactly one case:
  // the most negative value divided by -1 (e.g. -128 / -1 = 128 in 8 bits).
  if (quotientValue < range.min || quotientValue > range.max) {
    throw new MachineError(
      'DIVIDE_OVERFLOW',
      `Quotient ${quotientValue} does not fit in ${bits} ${mode} bits (range ${describeRange(range)}).`,
    )
  }

  const view = (value: bigint): ValueView => makeView(value, bits, signed)

  return {
    mode,
    bits,
    accBits,
    dividend: view(dividendValue),
    divisor: view(divisorValue),
    quotient: view(quotientValue),
    remainder: view(remainderValue),
    steps,
    signs: signed
      ? {
          dividendNegative,
          divisorNegative,
          quotientNegative,
          magnitudes: {
            dividend: dividendMagnitude.toString(),
            divisor: divisorMagnitude.toString(),
          },
        }
      : null,
    summary: `${dividendValue} / ${divisorValue} = ${quotientValue} remainder ${remainderValue}`,
    verification: `(${quotientValue} x ${divisorValue}) + ${remainderValue} = ${quotientValue * divisorValue + remainderValue} = ${dividendValue}`,
  }
}

/** Operands and settings as they arrive from the GUI. */
export type DivisionRequest = {
  dividend: OperandInput
  divisor: OperandInput
  bits: number
  mode: DivisionMode
}

/**
 * GUI entry point: parses both operands (decimal or binary, in either field)
 * and runs the division.
 *
 * Throws a `MachineError` for any bad input — malformed literal, value that
 * does not fit the data size, zero divisor, or a quotient that overflows.
 */
export function divide(request: DivisionRequest): DivisionResult {
  const { dividend, divisor, bits, mode } = request
  assertValidBits(bits)
  const signed = mode === 'signed'
  const dividendValue = readOperand(dividend, bits, signed, 'Dividend')
  const divisorValue = readOperand(divisor, bits, signed, 'Divisor')
  return divideValues(dividendValue, divisorValue, bits, mode)
}

// ---------------------------------------------------------------------------
// Plain-text rendering (console output, tests, README examples)
// ---------------------------------------------------------------------------

/**
 * Renders a completed division as a monospaced table.
 *
 * The GUI builds its own markup from `result.steps`; this exists for quick
 * verification from the terminal and for pasting worked examples into the
 * write-up.
 */
export function formatDivision(result: DivisionResult): string {
  const header = ['#', 'It', 'Operation', 'A'.padEnd(result.accBits), 'Q'.padEnd(result.bits), 'Q0']
  const rows = result.steps.map((step) => [
    String(step.index),
    step.iteration === 0 ? '-' : String(step.iteration),
    step.action,
    step.a,
    step.q,
    step.q0 === null ? '-' : String(step.q0),
  ])

  const widths = header.map((cell, column) =>
    Math.max(cell.length, ...rows.map((row) => row[column].length)),
  )
  const line = (cells: string[]): string =>
    cells.map((cell, column) => cell.padEnd(widths[column])).join('  ').trimEnd()

  return [
    `${result.mode} division, ${result.bits}-bit operands`,
    `Dividend M/Q: ${result.dividend.decimal} (${result.dividend.binary})`,
    `Divisor  M  : ${result.divisor.decimal} (${result.divisor.binary})`,
    '',
    line(header),
    line(widths.map((width) => '-'.repeat(width))),
    ...rows.map(line),
    '',
    `Quotient : ${result.quotient.decimal} (${result.quotient.binary})`,
    `Remainder: ${result.remainder.decimal} (${result.remainder.binary})`,
    `Check    : ${result.verification}`,
  ].join('\n')
}

/**
 * Convenience for tests and demos: the quotient bits assembled from the trace.
 * Reading Q0 down the `subtract`/`add` rows must reproduce the final Q, which
 * is a useful invariant to assert.
 */
export function quotientBitsFromSteps(result: DivisionResult): string {
  return result.steps
    .filter((step) => step.q0 !== null)
    .map((step) => String(step.q0))
    .join('')
}

/** Reads a trace-rendered accumulator string back into a signed value. */
export function accumulatorValue(step: DivisionStep): bigint {
  const magnitude = bitsToUnsigned(step.a)
  return step.a.startsWith('1') ? magnitude - (1n << BigInt(step.a.length)) : magnitude
}
