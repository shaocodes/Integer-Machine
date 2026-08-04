import StepTable from './StepTable'
import BinaryOperationForm from './BinaryOperationForm'

export default function DivisionTab() {
  return (
    <div className="bento-grid">
      <BinaryOperationForm
        title="Binary Division (Non-Restoring)"
        fields={['Dividend', 'Divisor']}
      />

      {/* Results Card */}
      <div className="glass-card bento-full">
        <h3 className="result-label">Step-by-Step Solution</h3>
        <StepTable columns={['Step', 'A', 'Q', 'Action']} rows={[]} />
        <div className="final-result">
          <span className="result-placeholder">Quotient will appear here</span>
          <span className="result-placeholder">Remainder will appear here</span>
        </div>
      </div>
    </div>
  )
}
