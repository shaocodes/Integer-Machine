# Integer-Machine

## Case Project: Computing Machine

### Machine 1, 2, 3, 4, 5 (Data Type Machine)

**Quick links** — [Live demo](#deployment) · [Video walkthrough](#video-walkthrough) ·
[Analysis write-up](docs/analysis.md) · [Running it locally](#running-the-project)

---

## General Directions

- **Application Platform:** Web-based application with a Graphical User Interface (GUI)
- **Programming Languages:** Any programming language of your choice
- **Application Repository:** GitHub (must contain the source code and analysis write-up)

Ensure the repository is set to **Public** or that the instructor is granted access.

---

# Required Outputs

All outputs must be stored in the GitHub repository.

## a.) Screenshots

Capture the program output for **all possible test cases**, including:

- Normal cases
- Special cases
- Edge cases
- Different input variations
- Other cases covering the specifications

---

## b.) Video Walkthrough

- **Duration:** 5–8 minutes
- Upload the video to **YouTube**
- Include the YouTube link in the **README.md**
- Ensure both the GitHub repository and the YouTube video are accessible

### The video must:

- Prove that the program is functioning correctly
- Demonstrate all test cases covering the specifications
  - Normal cases
  - Special cases
  - Different inputs
  - Edge cases

---

## c.) Source Code

Provide the **complete and well-commented source code**.

---

## d.) Deployment Link

Include the **live website deployment link** in the **About / Website** section of the GitHub repository.

---

## e.) Project Demo

A live project demo may be required if needed.

This can be conducted:

- Face-to-face
- Via Zoom

---

# Machine 1: Integer Machine

## Process

Integer arithmetic and conversion.

---

## 1. Convert Decimal to Unsigned and Signed Binary

### Inputs

- A decimal number
- Data size (ranging from **2 bits to 64 bits and beyond**)

### Outputs

- Unsigned binary representation
- Signed binary representation

The program must include **error checking for out-of-bounds values**.

---

## 2. Perform Multiplication and Division

### Multiplication

**Sequential Circuit Binary Multiplier**

### Division

**Non-Restoring Division Algorithm**

### Inputs

- Operands in either:
  - Decimal (must be converted to binary internally), or
  - Binary format
- Data size (in bits)

### Outputs

- Step-by-step solution
- Final result

---

# Project Documentation

## Deployment

> _Live site: to be added by Team Member 4 (also set it in the repository's About / Website field)._

## Video walkthrough

> _YouTube link: to be added once the 5–8 minute walkthrough is recorded._

---

## Running the project

Requires **Node.js 22.18 or newer** (the test suite runs TypeScript directly via
Node's built-in type stripping).

```bash
npm install     # install dependencies
npm run dev     # start the dev server
npm test        # run the logic test suite
npx tsc -b      # type-check
npx oxlint      # lint
npm run build   # production build
```

CI runs the type check, the lint, the test suite and the build on every push.

---

## Repository layout

```
src/
  lib/                  computation layer — pure logic, no DOM, no React
    errors.ts           MachineError + error codes shared by every module
    conversion.ts       decimal <-> binary, unsigned & signed, bit helpers
    division.ts         non-restoring division + step-by-step trace
    index.ts            public surface the GUI imports from
  App.tsx               GUI
tests/                  Node test-runner suites for src/lib
docs/
  analysis.md           analysis write-up: design decisions and algorithms
```

The computation layer is deliberately independent of the GUI: nothing under
`src/lib` imports React or touches the DOM, so the logic can be tested from
plain Node and the interface can be rebuilt without touching an algorithm.

---

## Module reference

### `conversion.ts` — decimal ↔ binary

| Export | Purpose |
| --- | --- |
| `convertDecimal(text, bits)` | Main conversion entry point. Returns **both** the unsigned and signed representation, each independently flagged as valid or out of bounds, plus the two's-complement derivation for negatives. |
| `convertBinary(text, bits)` | Reverse direction: reads one bit pattern as unsigned *and* as signed. |
| `toUnsignedBinary` / `toSignedBinary` | Single-representation conversion; throws `OUT_OF_RANGE`. |
| `fromUnsignedBinary` / `fromSignedBinary` | Binary literal → `bigint`. |
| `parseDecimal` / `parseBinary` | Input validation and normalisation. |
| `readOperand(operand, bits, signed, label)` | Shared operand reader used by the divider and multiplier — handles "decimal or binary" input in one place. |
| `unsignedMax` / `signedMin` / `signedMax` / `rangeOf` | Range limits for a data size. |
| `wrapToBits` / `bitsToUnsigned` / `bitsToSigned` / `groupBits` / `toHex` | Bit-level helpers for rendering register traces. |
| `MIN_BITS` / `MAX_BITS` | Accepted data sizes: 2 to 1024 bits. |

All values are `bigint`, so 64-bit and wider words stay exact.

### `division.ts` — non-restoring division

| Export | Purpose |
| --- | --- |
| `divide(request)` | GUI entry point. Takes both operands as decimal *or* binary, plus data size and mode. |
| `divideValues(dividend, divisor, bits, mode)` | Same algorithm on already-parsed `bigint`s. |
| `formatDivision(result)` | Renders a completed division as a plain-text table. |
| `DivisionResult` | Quotient, remainder, sign bookkeeping, a verification line, and `steps[]` — one row per register operation, ready to render as a table. |

### `errors.ts` — error handling

Every module throws `MachineError` with a machine-readable `code`
(`INVALID_BITS`, `EMPTY_INPUT`, `INVALID_DECIMAL`, `INVALID_BINARY`,
`BINARY_TOO_LONG`, `OUT_OF_RANGE`, `DIVIDE_BY_ZERO`, `DIVIDE_OVERFLOW`) and a
message that names both the offending value and the legal range. `attempt(fn)`
wraps any call into an `{ ok, value } | { ok, error }` result for components
that would rather not use `try`/`catch`.

### Example

```ts
import { convertDecimal, divide, formatDivision } from './lib'

const conversion = convertDecimal('-100', 8)
// conversion.signed   -> { ok: true, binary: '10011100', ... }
// conversion.unsigned -> { ok: false, message: '-100 is negative and cannot ...' }

const result = divide({
  dividend: { format: 'decimal', text: '200' },
  divisor: { format: 'binary', text: '00000111' },
  bits: 8,
  mode: 'unsigned',
})
// result.summary -> '200 / 7 = 28 remainder 4'
// result.steps   -> 17 rows: initialise, then shift + add/subtract per bit
console.log(formatDivision(result))
```

---

## Team responsibilities

| # | Area | Deliverables | Status |
| --- | --- | --- | --- |
| 1 | Conversion & repository | `src/lib/conversion.ts`, `src/lib/errors.ts`, data sizes 2–1024 bits, out-of-bounds checking, repo & docs | ✅ implemented and tested |
| 2 | Multiplier logic | `src/lib/multiplication.ts` — sequential circuit multiplier with step-by-step output | ⬜ pending |
| 3 | Division logic | `src/lib/division.ts` — non-restoring division with step-by-step output | ✅ implemented and tested |
| 4 | GUI & deployment | `src/App.tsx`, live deployment, screenshots of all test cases | ⬜ pending |

Shared: the 5–8 minute YouTube walkthrough and the live demo.

### Notes for Team Member 2

The multiplier can reuse `readOperand`, `wrapToBits`, `bitsToSigned`,
`groupBits` and `MachineError` as-is, and `DivisionStep` / `DivisionResult` in
`division.ts` are a working template for a step trace. Export the module from
`src/lib/index.ts` (a commented placeholder is already there).

### Notes for Team Member 4

Import from `src/lib` only — never reimplement arithmetic in a component.
`attempt()` turns any thrown `MachineError` into a renderable object, and
`result.steps[]` is designed to map one-to-one onto table rows: `action`, `a`,
`q`, `m`, `q0` and a plain-language `note` per row. The test-case matrix at the
end of [docs/analysis.md](docs/analysis.md) lists every case the screenshots
need to cover.
