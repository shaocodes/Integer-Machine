# Integer Machine — Analysis Write-up

This document explains *how* the machine works and *why* each design decision
was made. It covers the two areas implemented so far:

1. Decimal ↔ binary conversion, unsigned and signed (Team Member 1)
2. Non-restoring division (Team Member 3)

The sequential-circuit multiplier (Team Member 2) is documented in
[§4](#4-multiplication-sequential-circuit-multiplier) once implemented.

---

## 0. Design constraints that shaped everything else

### 0.1 Why `bigint` instead of `number`

The specification asks for data sizes "from 2 bits to 64 bits **and beyond**".
A JavaScript `number` is an IEEE-754 double: every integer above 2^53 − 1 is
inexact, and the bitwise operators (`&`, `<<`, `>>`) silently truncate to 32
bits. A 64-bit machine word therefore cannot be modelled with `number` at all.

Every value in `src/lib` is a `bigint`, which is exact at any width. The cost is
that literals need an `n` suffix (`255n`) and cannot be mixed with `number` — an
inconvenience that is worth an entire class of impossible bugs.

### 0.2 Widths are data, not types

A register width is passed explicitly to every function (`bits`) instead of
being baked into a type. That is what lets one code path serve 2-bit and
1024-bit operands, and it makes the width visible in every error message.

`MAX_BITS = 1024` is a practical guard rail, not an algorithmic limit: the
divider performs one loop iteration per bit and the GUI renders two table rows
per iteration, so a 100,000-bit request would freeze the browser tab rather than
fail cleanly.

### 0.3 Logic is separated from presentation

Nothing in `src/lib` imports React or touches the DOM. Each module is a pure
function from inputs to a plain result object. Three benefits:

- the logic is unit-tested from plain Node, with no browser and no test framework
- the GUI can be rebuilt or replaced without touching a single algorithm
- the step-by-step trace is *data* (an array of row objects), so the GUI decides
  how to render it — table, animation, or plain text

---

## 1. Decimal → unsigned binary

An *n*-bit unsigned field holds 0 … 2^n − 1. Conversion is the plain binary
expansion, zero-padded on the left to the data size.

```
200, 8 bits  →  11001000
  3, 2 bits  →  11
```

**Error checking.** A value is out of bounds when it is negative (an unsigned
field has no way to record a sign) or when it exceeds 2^n − 1. Both produce a
`MachineError` with code `OUT_OF_RANGE` and a message that states the offending
value *and* the legal range, e.g.

> `-5 is negative and cannot be stored as an unsigned value. Unsigned 8-bit range is 0 to 255.`

---

## 2. Decimal → signed binary (two's complement)

An *n*-bit two's-complement field holds −2^(n−1) … 2^(n−1) − 1. The range is
asymmetric: there is one more negative value than positive, because the pattern
`1000…0` is used for −2^(n−1) rather than for "negative zero".

Three representations of a signed integer are common — sign-and-magnitude, one's
complement, and two's complement. Two's complement is what this machine uses, for
the reason real hardware uses it: there is exactly one encoding of zero, and
addition and subtraction of signed values need no special case at all. The same
adder that computes 5 + 3 computes 5 + (−3), which is precisely what the
non-restoring divider in §3 depends on.

**Derivation.** For a negative value the machine shows the classic three-line
derivation (`twosComplementSteps`):

```
-5 in 8 bits
  magnitude |−5|   00000101
  invert every bit 11111010     (one's complement)
  add one          11111011     (two's complement)  ✓
```

Internally the conversion is done by modular reduction —
`((v mod 2^n) + 2^n) mod 2^n` — which produces the identical pattern in one step
and works for any width. The invert-and-increment version exists purely because
it is the derivation a reader can check by hand.

**The self-complementing edge case.** −128 in 8 bits inverts to `01111111` and
increments back to `10000000` — the value is its own two's complement. This is
tested explicitly, because it is where naive implementations overflow.

**Reading the same pattern both ways.** `convertBinary` reports one bit pattern
under both interpretations, which is the clearest demonstration of what two's
complement actually is:

```
11111101, 8 bits  →  unsigned 253,  signed −3
```

---

## 3. Division: the non-restoring algorithm

### 3.1 Registers

| Register | Width | Role |
| --- | --- | --- |
| `A` | n + 2 | Accumulator — the partial remainder |
| `Q` | n | Holds the dividend; fills with the quotient as the division proceeds |
| `M` | n | Divisor; never changes |

### 3.2 The algorithm

```
A ← 0, Q ← dividend, M ← divisor

repeat n times:
    1. shift the pair [A,Q] one place left      (Q's MSB moves into A's LSB)
    2. if A was negative:  A ← A + M
       else:               A ← A − M
    3. Q0 ← 1 if A is now non-negative, else Q0 ← 0

if A is negative:  A ← A + M          ← single corrective restore
quotient = Q,  remainder = A
```

### 3.3 Why "non-restoring"

A **restoring** divider subtracts M, checks the sign, and if the result went
negative it *immediately adds M back* before it can shift again — up to two
add/subtract operations per quotient bit.

A **non-restoring** divider leaves A negative and adds M on the *next* iteration
instead. The two are algebraically identical:

```
restoring:      shift(A + M) − M  =  2(A + M) − M  =  2A + M
non-restoring:  shift(A) + M      =  2A + M                    ✓
```

So the correction is deferred rather than skipped, and each quotient bit costs
exactly one add or subtract. Only one correction can ever remain outstanding
when the loop ends, which is why a single conditional restore after the loop is
sufficient.

Note that an *exact* division does not imply no final restore: 8 ÷ 4 ends with a
negative A and is corrected, while 7 ÷ 2 does not. The final restore depends on
the sign of the last partial remainder, not on divisibility.

### 3.4 Why the accumulator is n + 2 bits wide

Between iterations the algorithm maintains −M ≤ A < M. Step 1 doubles A before
step 2 restores that invariant, so the value that must be displayed lies in
[−2M, 2M − 1]. With M as large as 2^n − 1, a two's-complement register must hold
magnitudes up to 2^(n+1), which needs **n + 2 bits**: n magnitude bits, one guard
bit for the doubling, one sign bit.

Textbook diagrams often draw A as n or n + 1 bits, which is fine for small
hand-worked examples but wraps around on the widest operands (try 14 ÷ 15 in 4
bits). The arithmetic here is exact `bigint` regardless; the extra width only
affects how A is *rendered* — but rendering it too narrowly would show wrapped,
wrong-looking bit patterns in the trace. The test suite asserts that every
rendered accumulator round-trips back to its exact value, at every step of every
division in the exhaustive sweep.

### 3.5 Signed operands

Non-restoring division is defined on unsigned magnitudes, so signed division is
handled the way hardware handles it:

1. record the sign of each operand and divide |dividend| by |divisor|
2. the quotient is negative when the operand signs differ
3. the remainder always takes the sign of the **dividend**

This gives *truncated* (toward-zero) division — the same convention as C, Java
and JavaScript — and it preserves the identity

```
quotient × divisor + remainder = dividend
```

which the machine prints as a verification line under every result.

### 3.6 Error conditions

| Condition | Code | Example |
| --- | --- | --- |
| Divisor is zero | `DIVIDE_BY_ZERO` | 10 ÷ 0 |
| Operand does not fit the data size | `OUT_OF_RANGE` | 256 ÷ 2 at 8 unsigned bits |
| Quotient does not fit the data size | `DIVIDE_OVERFLOW` | −128 ÷ −1 at 8 signed bits |

The overflow case is worth calling out: −128 and −1 are both perfectly valid
8-bit signed operands, but their quotient +128 is not, because the signed range
stops at +127. It is the *only* pair of representable operands whose quotient
overflows, and it exists at every width (−2 ÷ −1 at 2 bits, and so on).

### 3.7 Worked example — 7 ÷ 2, 4-bit unsigned

Generated by `formatDivision()`; A is shown in 6 bits (4 + guard + sign).

```
#  It  Operation         A       Q     Q0
-  --  ----------------  ------  ----  --
1  -   Initialise        000000  0111  -
2  1   Shift left [A,Q]  000000  1110  -
3  1   A <- A - M        111110  1110  0
4  2   Shift left [A,Q]  111101  1100  -
5  2   A <- A + M        111111  1100  0
6  3   Shift left [A,Q]  111111  1000  -
7  3   A <- A + M        000001  1001  1
8  4   Shift left [A,Q]  000011  0010  -
9  4   A <- A - M        000001  0011  1

Quotient : 3 (0011)
Remainder: 1 (0001)
Check    : (3 x 2) + 1 = 7 = 7
```

Iteration 1 subtracts and goes negative (Q0 = 0). Iterations 2 and 3 *add*
instead of subtracting — the deferred restore in action. Iteration 3 lands
non-negative, so Q0 = 1. Reading the Q0 column downward gives `0011` = 3, the
quotient, and the loop happens to end non-negative so no final restore is
needed.

### 3.8 Worked example — −17 ÷ 5, 8-bit signed

```
#   It  Operation         A           Q         Q0
--  --  ----------------  ----------  --------  --
1   -   Initialise        0000000000  00010001  -
2   1   Shift left [A,Q]  0000000000  00100010  -
3   1   A <- A - M        1111111011  00100010  0
...
15  7   A <- A + M        0000000011  10000001  1
16  8   Shift left [A,Q]  0000000111  00000010  -
17  8   A <- A - M        0000000010  00000011  1
18  -   Apply signs       0000000010  00000011  -

Quotient : -3 (11111101)
Remainder: -2 (11111110)
Check    : (-3 x 5) + -2 = -17 = -17
```

The loop divides the magnitudes 17 ÷ 5 = 3 remainder 2; the final row applies
the signs. The signs differ, so the quotient is −3; the remainder follows the
dividend, so it is −2.

---

## 4. Multiplication (sequential circuit multiplier)

> Owned by Team Member 2 — to be written alongside `src/lib/multiplication.ts`.
> The conversion helpers it needs (`readOperand`, `wrapToBits`, `bitsToSigned`,
> `groupBits`) are already exported from `src/lib/conversion.ts`, and the
> `DivisionStep` / `DivisionResult` shapes in `src/lib/division.ts` are a
> ready-made template for the multiplier's step trace.

---

## 5. Verification strategy

`npm test` runs 49 tests with Node's built-in runner — no test framework
dependency, and Node executes the TypeScript directly.

Beyond the hand-checked cases, the divider is verified by an **exhaustive
sweep**: every 6-bit operand pair in both modes (4,032 unsigned + 4,032 signed
divisions). Each one is checked against four independent properties:

1. quotient and remainder match JavaScript's own `bigint` division
2. quotient × divisor + remainder = dividend
3. |remainder| < |divisor|, and the remainder carries the dividend's sign
4. the trace is well-formed — exactly n shifts, exactly n quotient bits, at most
   one restore, every rendered register round-trips to its exact value, and the
   Q0 column read downward reproduces the quotient

Property 4 matters as much as property 1 for this project: the deliverable is
the *step-by-step solution*, not just the answer, so the trace is tested as
rigorously as the result.

### Test-case matrix

Useful as a checklist when capturing screenshots and recording the walkthrough.

**Conversion**

| Case | Input | Expected |
| --- | --- | --- |
| Normal, positive | 100, 8 bits | unsigned & signed `01100100` |
| Normal, negative | −100, 8 bits | signed `10011100`; unsigned rejected |
| Unsigned-only | 200, 8 bits | unsigned `11001000`; signed rejected |
| Zero | 0, any width | all zeros in both |
| Positive edge | 127 / 255, 8 bits | signed max / unsigned max |
| Negative edge | −128, 8 bits | `10000000`, self-complementing |
| Out of bounds | 1000, 8 bits | both representations rejected |
| Smallest width | −2 … 3, 2 bits | full 2-bit range |
| 64-bit | 9223372036854775807 | 64-bit signed max |
| Beyond 64-bit | 2^127 − 1, 128 bits | 127 ones |
| Malformed | `3.5`, `12abc`, `0x1F` | `INVALID_DECIMAL` |
| Malformed binary | `1021`, 9 digits at 8 bits | `INVALID_BINARY`, `BINARY_TOO_LONG` |

**Division**

| Case | Input | Expected |
| --- | --- | --- |
| Normal | 200 ÷ 7, 8 bits unsigned | 28 r 4 |
| Exact | 144 ÷ 12, 8 bits unsigned | 12 r 0 |
| Zero dividend | 0 ÷ 5 | 0 r 0 |
| Divisor > dividend | 3 ÷ 200 | 0 r 3 |
| Divide by one | 255 ÷ 1 | 255 r 0 |
| Equal operands | 97 ÷ 97 | 1 r 0 |
| Smallest width | 3 ÷ 1, 2 bits | 3 r 0 |
| Signed ++ | 17 ÷ 5 | 3 r 2 |
| Signed −+ | −17 ÷ 5 | −3 r −2 |
| Signed +− | 17 ÷ −5 | −3 r 2 |
| Signed −− | −17 ÷ −5 | 3 r −2 |
| Signed edge | −128 ÷ 1, 8 bits | −128 r 0 |
| Overflow | −128 ÷ −1, 8 bits | `DIVIDE_OVERFLOW` |
| Divide by zero | 10 ÷ 0 | `DIVIDE_BY_ZERO` |
| Operand too large | 256 ÷ 2, 8 bits unsigned | `OUT_OF_RANGE` |
| Binary operands | `11001000` ÷ `00000111` | identical trace to 200 ÷ 7 |
| Mixed formats | `1100 1000` ÷ decimal 7 | identical trace to 200 ÷ 7 |
| 64-bit | (2^64 − 1) ÷ 1000000007 | 64 iterations |
| Beyond 64-bit | (2^127 − 1) ÷ 123456789 | 128 iterations |
