import { useState } from 'react'
import BitDisplay from './BitDisplay'
import ErrorMessage from './ErrorMessage'
import { attempt, convertDecimal, type DecimalConversion, type Representation } from '../lib'

/** Renders one representation: the bit boxes, or why it is out of bounds. */
function RepresentationCard({
  representation,
  highlightSignBit = false,
}: {
  representation: Representation | undefined
  highlightSignBit?: boolean
}) {
  if (!representation) {
    return <div className="result-placeholder">Result will appear here</div>
  }
  if (!representation.ok) {
    return <ErrorMessage message={representation.message} />
  }
  return (
    <>
      <BitDisplay bits={representation.binary} highlightSignBit={highlightSignBit} />
      <div className="final-result">
        <span className="result-badge">Hex: {representation.hex}</span>
      </div>
    </>
  )
}

export default function ConversionTab() {
  const [decimalValue, setDecimalValue] = useState('')
  const [bitSize, setBitSize] = useState('8')
  const [customBitSize, setCustomBitSize] = useState('')
  const [result, setResult] = useState<DecimalConversion | null>(null)
  const [error, setError] = useState('')

  const handleConvert = () => {
    const bits = Number(bitSize === 'custom' ? customBitSize : bitSize)
    // A malformed number or bad bit size throws; an out-of-range value does
    // not — it comes back flagged on the individual representation instead.
    const outcome = attempt(() => convertDecimal(decimalValue, bits))

    if (outcome.ok) {
      setResult(outcome.value)
      setError('')
    } else {
      setResult(null)
      setError(outcome.error.message)
    }
  }

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
              onKeyDown={(e) => e.key === 'Enter' && handleConvert()}
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
                max="1024"
                placeholder="2–1024"
                value={customBitSize}
                onChange={(e) => setCustomBitSize(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConvert()}
              />
            </div>
          )}
        </div>

        <button className="btn-primary" onClick={handleConvert}>Convert</button>
        <ErrorMessage message={error} />

        {/* Result ranges removed */}
      </div>

      {/* Unsigned Result Card */}
      <div className="glass-card">
        <h3 className="result-label">Unsigned Binary</h3>
        <RepresentationCard representation={result?.unsigned} />
      </div>

      {/* Signed Result Card */}
      <div className="glass-card">
        <h3 className="result-label">Signed Binary (Two's Complement)</h3>
        <RepresentationCard
          representation={result?.signed}
          highlightSignBit
        />
        {result?.signedSteps && (
          <div className="step-table-container">
            <table className="step-table">
              <thead>
                <tr>
                  <th>Two's Complement Derivation</th>
                  <th>Bits</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Magnitude</td>
                  <td>{result.signedSteps.magnitude}</td>
                </tr>
                <tr>
                  <td>Invert every bit</td>
                  <td>{result.signedSteps.inverted}</td>
                </tr>
                <tr>
                  <td>Add one</td>
                  <td>{result.signedSteps.result}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
