/**
 * Shared error type for every computational module of the Integer Machine.
 *
 * The logic modules are deliberately UI-agnostic: they never touch the DOM and
 * never print anything. When an input cannot be processed they throw a
 * `MachineError` carrying a machine-readable `code` plus a human-readable
 * message, so the GUI layer can decide how to surface it (inline field error,
 * toast, banner, ...).
 */

/** Every failure mode the machine can report. */
export type MachineErrorCode =
  /** Data size is not an integer, or falls outside [MIN_BITS, MAX_BITS]. */
  | 'INVALID_BITS'
  /** The user submitted an empty / whitespace-only field. */
  | 'EMPTY_INPUT'
  /** Decimal field contains characters that are not part of an integer. */
  | 'INVALID_DECIMAL'
  /** Binary field contains characters other than 0 and 1. */
  | 'INVALID_BINARY'
  /** Binary literal has more digits than the selected data size. */
  | 'BINARY_TOO_LONG'
  /** Value cannot be represented in the selected data size (out of bounds). */
  | 'OUT_OF_RANGE'
  /** Division was attempted with a zero divisor. */
  | 'DIVIDE_BY_ZERO'
  /** The quotient does not fit in the selected data size. */
  | 'DIVIDE_OVERFLOW'

/** Error thrown by the conversion / multiplication / division modules. */
export class MachineError extends Error {
  readonly code: MachineErrorCode

  constructor(code: MachineErrorCode, message: string) {
    super(message)
    this.name = 'MachineError'
    this.code = code
  }
}

/** Narrowing helper so callers can `catch` without an `instanceof` dance. */
export function isMachineError(error: unknown): error is MachineError {
  return error instanceof MachineError
}

/**
 * Runs `fn` and normalises the outcome into a discriminated union.
 *
 * Handy for the GUI: `const r = attempt(() => convertDecimal(...))` never
 * throws, so a React component can render `r.error.message` directly.
 * Unexpected (non-`MachineError`) exceptions are re-thrown — they are bugs,
 * not user input problems.
 */
export function attempt<T>(
  fn: () => T,
): { ok: true; value: T } | { ok: false; error: MachineError } {
  try {
    return { ok: true, value: fn() }
  } catch (error) {
    if (isMachineError(error)) return { ok: false, error }
    throw error
  }
}
