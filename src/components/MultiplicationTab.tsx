import { useState } from 'react'
import StepTable from './StepTable'
import ErrorMessage from './ErrorMessage'

export default function MultiplicationTab() {
  const [inputFormat, setInputFormat] = useState<'decimal' | 'binary'>('decimal')
  const [multiplicand, setMultiplicand] = useState('')
  const [multiplier, setMultiplier] = useState('')
  const [bitSize, setBitSize] = useState('8')

  return (
    <div className="bento-grid">
      {/* Input Card */}
      <div className="glass-card bento-full">
        <h2 className="card-title">Binary Multiplication (Booth's Algorithm)</h2>

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
            <label className="input-label">Multiplicand</label>
            <input
              type="text"
              className="input-field"
              placeholder={inputFormat === 'decimal' ? 'e.g. 5' : 'e.g. 0101'}
              value={multiplicand}
              onChange={(e) => setMultiplicand(e.target.value)}
            />
          </div>
          <div className="input-group" style={{ flex: 1 }}>
            <label className="input-label">Multiplier</label>
            <input
              type="text"
              className="input-field"
              placeholder={inputFormat === 'decimal' ? 'e.g. 3' : 'e.g. 0011'}
              value={multiplier}
              onChange={(e) => setMultiplier(e.target.value)}
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
        <StepTable columns={['Step', 'A', 'Q', 'Q₋₁', 'Action']} rows={[]} />
        <div className="final-result">
          <span className="result-placeholder">Product will appear here</span>
        </div>
      </div>
    </div>
  )
}
