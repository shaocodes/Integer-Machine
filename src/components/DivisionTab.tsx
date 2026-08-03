import { useState } from 'react'
import StepTable from './StepTable'
import ErrorMessage from './ErrorMessage'

export default function DivisionTab() {
  const [inputFormat, setInputFormat] = useState<'decimal' | 'binary'>('decimal')
  const [dividend, setDividend] = useState('')
  const [divisor, setDivisor] = useState('')
  const [bitSize, setBitSize] = useState('8')

  return (
    <div className="bento-grid">
      {/* Input Card */}
      <div className="glass-card bento-full">
        <h2 className="card-title">Binary Division (Non-Restoring)</h2>

        <div className="toggle-switch">
          <span className={`toggle-switch-label ${inputFormat === 'decimal' ? 'active' : ''}`}>Decimal</span>
          <div
            className={`toggle-switch-track ${inputFormat === 'binary' ? 'active' : ''}`}
            onClick={() => setInputFormat(inputFormat === 'decimal' ? 'binary' : 'decimal')}
            role="switch"
            aria-checked={inputFormat === 'binary'}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setInputFormat(inputFormat === 'decimal' ? 'binary' : 'decimal'); } }}
          >
            <div className="toggle-switch-thumb" />
          </div>
          <span className={`toggle-switch-label ${inputFormat === 'binary' ? 'active' : ''}`}>Binary</span>
        </div>

        <div className="input-row">
          <div className="input-group" style={{ flex: 1 }}>
            <label className="input-label">Dividend</label>
            <input
              type="text"
              className="input-field"
              placeholder={inputFormat === 'decimal' ? 'e.g. 7' : 'e.g. 0111'}
              value={dividend}
              onChange={(e) => setDividend(e.target.value)}
            />
          </div>
          <div className="input-group" style={{ flex: 1 }}>
            <label className="input-label">Divisor</label>
            <input
              type="text"
              className="input-field"
              placeholder={inputFormat === 'decimal' ? 'e.g. 3' : 'e.g. 0011'}
              value={divisor}
              onChange={(e) => setDivisor(e.target.value)}
            />
          </div>
          <div className="input-group" style={{ flex: 0.5 }}>
            <label className="input-label">Bit Size</label>
            <input
              type="number"
              className="input-field"
              min="2"
              max="64"
              placeholder="8"
              value={bitSize}
              onChange={(e) => setBitSize(e.target.value)}
            />
          </div>
        </div>

        <button className="btn-primary" onClick={() => {}}>Compute</button>
        <ErrorMessage message="" />
      </div>

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
