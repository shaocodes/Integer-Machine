/**
 * Machine 1 — Part 1: Decimal <-> Binary conversion (unsigned & signed).
 *
 * Responsibilities covered here (Team Member 1):
 *   - Decimal to unsigned binary
 *   - Decimal to signed binary (two's complement)
 *   - Arbitrary data sizes, from 2 bits up to MAX_BITS ("64 bits and beyond")
 *   - Out-of-bounds / malformed-input error checking
 *   - Low-level bit helpers reused by the multiplier and divider modules
 *
 * Every value is handled with `bigint`, never `number`. A JavaScript `number`
 * loses precision past 2^53, so a 64-bit (let alone 128-bit) machine word
 * cannot be modelled with it. `bigint` is exact at any width.
 */

import { MachineError } from './errors.ts'

// ---------------------------------------------------------------------------
// Data sizes
// ---------------------------------------------------------------------------

/**
 * Smallest data size the machine accepts.
 *
 * The specification says "2 bits and up". Two bits is also the smallest width
 * where a signed representation is still meaningful (range -2..1).
 */
export const MIN_BITS = 2

/**
 * Largest data size the machine accepts.
 *
 * The algorithms themselves have no upper limit (bigint is unbounded), but the
 * divider runs one iteration per bit and the GUI has to render one table row
 * per iteration, so a practical guard rail is applied. 1024 bits is far past
 * the "64 bits and beyond" requirement.
 */
export const MAX_BITS = 1024

/** Inclusive value range of a representation. */
export type Range = { min: bigint; max: bigint }

/**
 * Validates a data size and throws `INVALID_BITS` when it is unusable.
 * Called at the entry point of every public function in the machine.
 */
export function assertValidBits(bits: number): void {
  if (!Number.isInteger(bits)) {
    throw new MachineError('INVALID_BITS', 'Data size must be a whole number of bits.')
  }
  if (bits < MIN_BITS || bits > MAX_BITS) {
    throw new MachineError(
      'INVALID_BITS',
      `Data size must be between ${MIN_BITS} and ${MAX_BITS} bits (got ${bits}).`,
    )
  }
}

/** Largest value an n-bit unsigned field can hold: 2^n - 1. */
export function unsignedMax(bits: number): bigint {
  assertValidBits(bits)
  return (1n << BigInt(bits)) - 1n
}

/** Most negative value an n-bit two's-complement field can hold: -2^(n-1). */
export function signedMin(bits: number): bigint {
  assertValidBits(bits)
  return -(1n << BigInt(bits - 1))
}

/** Largest value an n-bit two's-complement field can hold: 2^(n-1) - 1. */
export function signedMax(bits: number): bigint {
  assertValidBits(bits)
  return (1n << BigInt(bits - 1)) - 1n
}

/** Inclusive range of an n-bit field in the requested interpretation. */
export function rangeOf(bits: number, signed: boolean): Range {
  return signed
    ? { min: signedMin(bits), max: signedMax(bits) }
    : { min: 0n, max: unsignedMax(bits) }
}

/** Human-readable range, e.g. "-128 to 127". Used in error messages and hints. */
export function describeRange(range: Range): string {
  return `${range.min} to ${range.max}`
}

// ---------------------------------------------------------------------------
// Input parsing
// ---------------------------------------------------------------------------

/**
 * Parses a decimal integer typed by the user.
 *
 * Accepts an optional leading sign and tolerates digit separators that people
 * naturally type (spaces, underscores, thousands commas): "-1,048,576" and
 * "-1_048_576" both parse. Rejects anything else — notably decimal points,
 * since this is an *integer* machine.
 */
export function parseDecimal(text: string): bigint {
  const cleaned = text.trim().replace(/[_,\s]/g, '')
  if (cleaned === '' || cleaned === '+' || cleaned === '-') {
    throw new MachineError('EMPTY_INPUT', 'Enter a decimal number.')
  }
  if (!/^[+-]?\d+$/.test(cleaned)) {
    throw new MachineError(
      'INVALID_DECIMAL',
      `"${text.trim()}" is not a whole decimal number. Digits 0-9 with an optional leading sign only.`,
    )
  }
  return BigInt(cleaned)
}

/**
 * Parses a binary literal typed by the user and normalises it to exactly
 * `bits` digits.
 *
 * Accepts an optional `0b` prefix and the same separators as `parseDecimal`
 * (so nibble-grouped input such as "1010 1100" works). A literal shorter than
 * the data size is left-padded with zeros; a longer one is an error rather
 * than a silent truncation, because silently dropping the high bits of an
 * operand would produce a confidently wrong answer.
 *
 * Note: the literal is read *as typed at the given width*. To enter a negative
 * value in signed mode, type its full-width two's-complement pattern
 * (e.g. -3 in 8 bits is "11111101", not "101").
 */
export function parseBinary(text: string, bits: number): string {
  assertValidBits(bits)
  const cleaned = text.trim().replace(/[_,\s]/g, '').replace(/^0[bB]/, '')
  if (cleaned === '') {
    throw new MachineError('EMPTY_INPUT', 'Enter a binary number.')
  }
  if (!/^[01]+$/.test(cleaned)) {
    throw new MachineError(
      'INVALID_BINARY',
      `"${text.trim()}" is not a binary number. Only the digits 0 and 1 are allowed.`,
    )
  }
  if (cleaned.length > bits) {
    throw new MachineError(
      'BINARY_TOO_LONG',
      `That literal is ${cleaned.length} bits long but the data size is ${bits} bits.`,
    )
  }
  return cleaned.padStart(bits, '0')
}

// ---------------------------------------------------------------------------
// Bit-level helpers (also used by the multiplier and divider modules)
// ---------------------------------------------------------------------------

/**
 * Formats `value` as a `width`-digit bit pattern, wrapping modulo 2^width.
 *
 * No range checking: negative values come back as their two's complement and
 * oversized values are truncated. This is the raw "what the register would
 * physically hold" view, which is exactly what a step-by-step hardware trace
 * needs. Use `toUnsignedBinary` / `toSignedBinary` when the value is supposed
 * to be validated against the field first.
 */
export function wrapToBits(value: bigint, width: number): string {
  const modulus = 1n << BigInt(width)
  const wrapped = ((value % modulus) + modulus) % modulus
  return wrapped.toString(2).padStart(width, '0')
}

/** Reads a bit pattern as a plain unsigned magnitude. No width validation. */
export function bitsToUnsigned(bin: string): bigint {
  return bin === '' ? 0n : BigInt(`0b${bin}`)
}

/** Reads a bit pattern as a two's-complement signed value. */
export function bitsToSigned(bin: string): bigint {
  const magnitude = bitsToUnsigned(bin)
  // A leading 1 means the value is negative: subtract 2^n to fold it over.
  return bin.startsWith('1') ? magnitude - (1n << BigInt(bin.length)) : magnitude
}

/** Splits a bit string into fixed-size groups for readable output. */
export function groupBits(bin: string, size = 4): string {
  if (size <= 0) return bin
  const groups: string[] = []
  // Group from the right so the least significant nibble is always complete.
  for (let end = bin.length; end > 0; end -= size) {
    groups.unshift(bin.slice(Math.max(0, end - size), end))
  }
  return groups.join(' ')
}

/** Hexadecimal rendering of a bit pattern, zero-padded to whole nibbles. */
export function toHex(bin: string): string {
  const padded = bin.padStart(Math.ceil(bin.length / 4) * 4, '0')
  return bitsToUnsigned(padded)
    .toString(16)
    .toUpperCase()
    .padStart(padded.length / 4, '0')
}

// ---------------------------------------------------------------------------
// Decimal -> binary
// ---------------------------------------------------------------------------

/**
 * Decimal to unsigned binary.
 * Throws `OUT_OF_RANGE` for negatives (unsigned fields have no sign) and for
 * values above 2^n - 1.
 */
export function toUnsignedBinary(value: bigint, bits: number): string {
  const range = rangeOf(bits, false)
  if (value < range.min || value > range.max) {
    throw new MachineError(
      'OUT_OF_RANGE',
      value < 0n
        ? `${value} is negative and cannot be stored as an unsigned value. Unsigned ${bits}-bit range is ${describeRange(range)}.`
        : `${value} does not fit in ${bits} unsigned bits (range ${describeRange(range)}).`,
    )
  }
  return value.toString(2).padStart(bits, '0')
}

/**
 * Decimal to signed binary, in two's-complement form.
 * Throws `OUT_OF_RANGE` outside [-2^(n-1), 2^(n-1) - 1].
 */
export function toSignedBinary(value: bigint, bits: number): string {
  const range = rangeOf(bits, true)
  if (value < range.min || value > range.max) {
    throw new MachineError(
      'OUT_OF_RANGE',
      `${value} does not fit in ${bits} signed bits (range ${describeRange(range)}).`,
    )
  }
  return wrapToBits(value, bits)
}

/** Binary to decimal, read as unsigned. Validates digits and width. */
export function fromUnsignedBinary(text: string, bits: number): bigint {
  return bitsToUnsigned(parseBinary(text, bits))
}

/** Binary to decimal, read as two's-complement signed. */
export function fromSignedBinary(text: string, bits: number): bigint {
  return bitsToSigned(parseBinary(text, bits))
}

// ---------------------------------------------------------------------------
// Worked two's-complement derivation (for the step-by-step display)
// ---------------------------------------------------------------------------

/** The classic "write the magnitude, invert, add one" derivation. */
export type TwosComplementSteps = {
  /** |value| written in `bits` bits. */
  magnitude: string
  /** Every bit flipped (one's complement). */
  inverted: string
  /** One's complement + 1 — the final two's-complement pattern. */
  result: string
}

/**
 * Produces the three-line derivation shown next to a negative conversion.
 * Returns `null` for non-negative values, where the signed pattern is simply
 * the plain binary expansion and no derivation is needed.
 */
export function twosComplementSteps(value: bigint, bits: number): TwosComplementSteps | null {
  assertValidBits(bits)
  if (value >= 0n) return null

  const magnitudeValue = -value
  // -2^(n-1) is representable even though +2^(n-1) is not, so the magnitude is
  // wrapped rather than range-checked here; the caller has already validated.
  const magnitude = wrapToBits(magnitudeValue, bits)
  const inverted = magnitude
    .split('')
    .map((bit) => (bit === '0' ? '1' : '0'))
    .join('')
  const result = wrapToBits(bitsToUnsigned(inverted) + 1n, bits)
  return { magnitude, inverted, result }
}

// ---------------------------------------------------------------------------
// High-level conversion used by the GUI
// ---------------------------------------------------------------------------

/** One rendered representation, or the reason it could not be produced. */
export type Representation =
  | { ok: true; binary: string; grouped: string; hex: string }
  | { ok: false; code: 'OUT_OF_RANGE'; message: string }

/** Full result of a decimal -> binary conversion. */
export type DecimalConversion = {
  /** The input as typed (trimmed), for echoing back in the UI. */
  input: string
  /** Parsed value. */
  value: bigint
  bits: number
  /** Unsigned representation, or an out-of-bounds explanation. */
  unsigned: Representation
  /** Signed (two's complement) representation, or an out-of-bounds explanation. */
  signed: Representation
  /** Derivation for negative values; `null` when the value is non-negative. */
  signedSteps: TwosComplementSteps | null
  /** The valid ranges for this data size, for display alongside the result. */
  ranges: { unsigned: Range; signed: Range }
}

/** Wraps a conversion attempt into a `Representation`. */
function represent(convert: () => string): Representation {
  try {
    const binary = convert()
    return { ok: true, binary, grouped: groupBits(binary), hex: toHex(binary) }
  } catch (error) {
    if (error instanceof MachineError && error.code === 'OUT_OF_RANGE') {
      return { ok: false, code: 'OUT_OF_RANGE', message: error.message }
    }
    throw error
  }
}

/**
 * Main entry point for the conversion screen.
 *
 * Converts one decimal input into *both* representations at the given data
 * size. The two representations are reported independently: a negative number
 * has a valid signed form and an invalid unsigned form, and the user should
 * see both facts at once instead of a single blanket error.
 *
 * Throws only for problems with the input itself (empty, malformed, bad data
 * size). Out-of-bounds values are reported per representation.
 */
export function convertDecimal(text: string, bits: number): DecimalConversion {
  assertValidBits(bits)
  const value = parseDecimal(text)
  return {
    input: text.trim(),
    value,
    bits,
    unsigned: represent(() => toUnsignedBinary(value, bits)),
    signed: represent(() => toSignedBinary(value, bits)),
    signedSteps: value < 0n && value >= signedMin(bits) ? twosComplementSteps(value, bits) : null,
    ranges: { unsigned: rangeOf(bits, false), signed: rangeOf(bits, true) },
  }
}

/** Full result of a binary -> decimal conversion. */
export type BinaryConversion = {
  input: string
  bits: number
  /** Input normalised to exactly `bits` digits. */
  binary: string
  grouped: string
  hex: string
  /** Value when the pattern is read as unsigned. */
  unsignedValue: bigint
  /** Value when the same pattern is read as two's-complement signed. */
  signedValue: bigint
}

/**
 * Reverse direction: reads one bit pattern under both interpretations.
 *
 * The same 8-bit pattern 11111101 is 253 unsigned and -3 signed; showing both
 * side by side is the clearest way to demonstrate what two's complement is.
 */
export function convertBinary(text: string, bits: number): BinaryConversion {
  assertValidBits(bits)
  const binary = parseBinary(text, bits)
  return {
    input: text.trim(),
    bits,
    binary,
    grouped: groupBits(binary),
    hex: toHex(binary),
    unsignedValue: bitsToUnsigned(binary),
    signedValue: bitsToSigned(binary),
  }
}

// ---------------------------------------------------------------------------
// Shared result helpers for the multiplier / divider modules
// ---------------------------------------------------------------------------

/** A computed number reported in both bases. */
export type ValueView = {
  decimal: string
  binary: string
  grouped: string
}

/**
 * Renders a result value for display, validating it against the field width.
 * Shared by the divider and the multiplier so their outputs stay consistent.
 */
export function makeView(value: bigint, bits: number, signed: boolean): ValueView {
  const binary = signed ? toSignedBinary(value, bits) : toUnsignedBinary(value, bits)
  return { decimal: value.toString(), binary, grouped: groupBits(binary) }
}

// ---------------------------------------------------------------------------
// Operand helper shared with the multiplier / divider modules
// ---------------------------------------------------------------------------

/** How an operand was typed. */
export type OperandFormat = 'decimal' | 'binary'

/** A single operand as it arrives from the GUI, before parsing. */
export type OperandInput = {
  format: OperandFormat
  text: string
}

/**
 * Turns a raw operand into a value, honouring the requested format and
 * signedness, and validates it against the data size.
 *
 * This is the single place where "decimal input is converted to binary
 * internally" happens, so the multiplier and the divider stay in agreement
 * about what a given typed string means.
 *
 * @param label Field name used in error messages, e.g. "Dividend".
 */
export function readOperand(
  operand: OperandInput,
  bits: number,
  signed: boolean,
  label: string,
): bigint {
  assertValidBits(bits)

  if (operand.format === 'binary') {
    const pattern = parseBinary(operand.text, bits)
    return signed ? bitsToSigned(pattern) : bitsToUnsigned(pattern)
  }

  const value = parseDecimal(operand.text)
  const range = rangeOf(bits, signed)
  if (value < range.min || value > range.max) {
    throw new MachineError(
      'OUT_OF_RANGE',
      `${label} ${value} does not fit in ${bits} ${signed ? 'signed' : 'unsigned'} bits (range ${describeRange(range)}).`,
    )
  }
  return value
}
