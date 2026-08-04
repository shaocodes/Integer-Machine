import { useState } from 'react'
import StepTable from './StepTable'
import BinaryOperationForm from './BinaryOperationForm'
import { attempt, multiply, type MultiplicationResult } from '../lib'
import type { OperationValues } from './types'

const COLUMNS = ['Step', 'Action', 'C', 'A', 'Q', 'Q₀']

export default function MultiplicationTab() {
  const [result, setResult] = useState<MultiplicationResult | null>(null)
  const [error, setError] = useState('')

  const handleCompute = (values: OperationValues) => {
    // `attempt` turns a thrown MachineError into a plain object, so bad input
    // renders as an error message instead of crashing the tab.
    const outcome = attempt(() =>
      multiply({
        multiplicand: { format: values.format, text: values.left },
        multiplier: { format: values.format, text: values.right },
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
    C: step.c,
    A: step.a,
    Q: step.q,
    'Q₀': step.q0 === null ? '' : String(step.q0),
  }))

  return (
    <div className="bento-grid">
      <BinaryOperationForm
        title="Binary Multiplication (Sequential Circuit Multiplier)"
        fields={['Multiplicand', 'Multiplier']}
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
              <span className="result-badge">Product: {result.product.decimal}</span>
              <span className="result-badge">Binary: {result.product.binary}</span>
              <span className="result-badge">
                A:Q = {result.halves.a} {result.halves.q}
              </span>
              <span className="result-badge">{result.summary}</span>
            </>
          ) : (
            <span className="result-placeholder">Product will appear here</span>
          )}
        </div>
      </div>
    </div>
  )
}
