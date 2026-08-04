# Integer-Machine

## Case Project: Computing Machine

### Machine 1, 2, 3, 4, 5 (Data Type Machine)

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

![Test Cases Screenshot](./tests_result.png)

---

## b.) Video Walkthrough

LINK: https://youtu.be/3uOtCqKVlUA
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

**Live site:** ![Test Cases Screenshot](./tests_result.png) · **Video walkthrough:** (https://youtu.be/3uOtCqKVlUA)

## Running it

Requires Node.js 22.18+.

```bash
npm install     # install dependencies
npm run dev     # start the dev server
npm test        # run the logic tests
npm run build   # production build
```

## Structure

```
src/
  lib/          computation logic — pure functions, no DOM
    conversion.ts      decimal <-> binary, unsigned & signed, 2-1024 bits
    multiplication.ts  sequential circuit multiplier + step-by-step trace
    division.ts        non-restoring division + step-by-step trace
    errors.ts          shared error type and codes
  components/   GUI
tests/          test suites for src/lib
docs/
  analysis.md   write-up: design decisions, algorithms, test-case matrix
```

The GUI imports from `src/lib` — `convertDecimal()`, `multiply()` and `divide()`
are the entry points, and the two arithmetic functions return a `steps[]` array
with one row per register operation. See [docs/analysis.md](docs/analysis.md)
for how the algorithms work.

## Team

| # | Area | Status |
| --- | --- | --- |
| 1 | Conversion & repository | done |
| 2 | Multiplier logic | done |
| 3 | Division logic | done |
| 4 | GUI & deployment | done |
