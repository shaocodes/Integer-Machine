import { useState } from 'react'
import BitDisplay from './BitDisplay'
import ErrorMessage from './ErrorMessage'

export default function ConversionTab() {
  const [decimalValue, setDecimalValue] = useState('')
  const [bitSize, setBitSize] = useState('8')
  const [customBitSize, setCustomBitSize] = useState('')

  return (
    <div className="bento-grid">
      {/* Input Card - Full Width */}
      <div className="glass-card bento-full">
        <h2 className="card-title">Decimal to Binary Conversion</h2>

        <div className="input-row">
          <div className="input-group" style={{ flex: 2 }}>
            <label className="input-label">Decimal Number</label>
            <input
              type="text"
              className="input-field"
              placeholder="Enter a decimal number (e.g. 42)"
              value={decimalValue}
              onChange={(e) => setDecimalValue(e.target.value)}
            />
          </div>

          <div className="input-group" style={{ flex: 1 }}>
            <label className="input-label">Bit Size</label>
            <select
              className="select-field input-field"
              value={bitSize}
              onChange={(e) => setBitSize(e.target.value)}
            >
              <option value="8">8-bit</option>
              <option value="16">16-bit</option>
              <option value="32">32-bit</option>
              <option value="64">64-bit</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {bitSize === 'custom' && (
            <div className="input-group" style={{ flex: 1 }}>
              <label className="input-label">Custom Bits</label>
              <input
                type="number"
                className="input-field"
                min="2"
                max="128"
                placeholder="2–128"
                value={customBitSize}
                onChange={(e) => setCustomBitSize(e.target.value)}
              />
            </div>
          )}
        </div>

        <button className="btn-primary" onClick={() => {}}>Convert</button>
        <ErrorMessage message="" />
      </div>

      {/* Unsigned Result Card */}
      <div className="glass-card">
        <h3 className="result-label">Unsigned Binary</h3>
        <BitDisplay bits="" label="Unsigned Binary" />
      </div>

      {/* Signed Result Card */}
      <div className="glass-card">
        <h3 className="result-label">Signed Binary (Sign-Magnitude)</h3>
        <BitDisplay bits="" label="Signed Binary" highlightSignBit />
      </div>
    </div>
  )
}
