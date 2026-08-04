/** Shared prop types for the operation components. */

import type { OperandFormat } from '../lib'

/** Everything BinaryOperationForm hands back when the user hits Compute. */
export type OperationValues = {
  left: string
  right: string
  /** Raw text from the bit-size field; the logic layer validates it. */
  bits: number
  format: OperandFormat
  mode: 'unsigned' | 'signed'
}
