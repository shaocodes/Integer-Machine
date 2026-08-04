/**
 * Public surface of the Integer Machine computation layer.
 *
 * The GUI should import from here (`import { convertDecimal } from './lib'`)
 * rather than reaching into individual files, so modules can be reorganised
 * without touching components.
 *
 * Nothing in `src/lib` touches the DOM, React, or `window`: every module is a
 * pure function of its inputs, which is what makes the logic unit-testable
 * from plain Node (`npm test`).
 */

export * from './errors.ts'
export * from './conversion.ts'
export * from './division.ts'
// Team Member 2's sequential multiplier plugs in here:
// export * from './multiplication.ts'
