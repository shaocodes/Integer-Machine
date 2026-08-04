import { useState } from 'react'
import StepTable from './StepTable'
import BinaryOperationForm from './BinaryOperationForm'
import { attempt, divide, type DivisionResult } from '../lib'
import type { OperationValues } from './types'

const COLUMNS = ['Step', 'Action', 'A', 'Q', 'Q₀']

export default function DivisionTab() {
  const [result, setResult] = useState<DivisionResult | null>(null)
  const [error, setError] = useState('')

  const handleCompute = (values: OperationValues) => {
    // `attempt` turns a thrown MachineError into a plain object, so bad input
    // (zero divisor, out-of-range operand, ...) renders as an error message.
    const outcome = attempt(() =>
      divide({
        dividend: { format: values.format, text: values.left },
        divisor: { format: values.format, text: values.right },
        bits: values.bits,
        mode: values.mode,
      }),
    )

    if (outcome.ok) {
      setResult(outcome.value)
      setError('')
    } else {
      setResult(null)
      setError(outcome.error.message)
    }
  }

  const rows = (result?.steps ?? []).map((step) => ({
    Step: String(step.index),
    Action: step.action,
    A: step.a,
    Q: step.q,
    'Q₀': step.q0 === null ? '' : String(step.q0),
  }))

  return (
    <div className="bento-grid">
      <BinaryOperationForm
        title="Binary Division (Non-Restoring)"
        fields={['Dividend', 'Divisor']}
        error={error}
        onCompute={handleCompute}
      />

      {/* Results Card */}
      <div className="glass-card bento-full">
        <h3 className="result-label">Step-by-Step Solution</h3>
        <StepTable columns={COLUMNS} rows={rows} />
        <div className="final-result">
          {result ? (
            <>
              <span className="result-badge">
                Quotient: {result.quotient.decimal} ({result.quotient.binary})
              </span>
              <span className="result-badge">
                Remainder: {result.remainder.decimal} ({result.remainder.binary})
              </span>
              <span className="result-badge">Check: {result.verification}</span>
            </>
          ) : (
            <>
              <span className="result-placeholder">Quotient will appear here</span>
              <span className="result-placeholder">Remainder will appear here</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
