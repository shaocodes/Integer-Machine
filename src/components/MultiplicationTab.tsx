import StepTable from './StepTable'
import BinaryOperationForm from './BinaryOperationForm'

export default function MultiplicationTab() {
  return (
    <div className="bento-grid">
      <BinaryOperationForm
        title="Binary Multiplication (Booth's Algorithm)"
        fields={['Multiplicand', 'Multiplier']}
      />

      {/* Results Card */}
      <div className="glass-card bento-full">
        <h3 className="result-label">Step-by-Step Solution</h3>
        <StepTable columns={['Step', 'A', 'Q', 'Q₋₁', 'Action']} rows={[]} />
        <div className="final-result">
          <span className="result-placeholder">Product will appear here</span>
        </div>
      </div>
    </div>
  )
}
