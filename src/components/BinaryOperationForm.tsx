import { useState } from 'react'
import ErrorMessage from './ErrorMessage'
import type { OperationValues } from './types'

interface BinaryOperationFormProps {
  title: string
  fields: [string, string]
  /** Error text from the last computation, or '' when it succeeded. */
  error: string
  /** Called with the current field values when the user hits Compute. */
  onCompute: (values: OperationValues) => void
}

export default function BinaryOperationForm({
  title,
  fields,
  error,
  onCompute,
}: BinaryOperationFormProps) {
  const [inputFormat, setInputFormat] = useState<'decimal' | 'binary'>('decimal')
  const [mode, setMode] = useState<'unsigned' | 'signed'>('unsigned')
  const [leftValue, setLeftValue] = useState('')
  const [rightValue, setRightValue] = useState('')
  const [bitSize, setBitSize] = useState('8')

  const toggleFormat = () => setInputFormat(inputFormat === 'decimal' ? 'binary' : 'decimal')

  const compute = () =>
    onCompute({
      left: leftValue,
      right: rightValue,
      // Number('') is 0, which the logic layer rejects with a clear message.
      bits: Number(bitSize),
      format: inputFormat,
      mode,
    })

  return (
    <div className="glass-card bento-full">
      <h2 className="card-title">{title}</h2>

      <div className="toggle-switch">
        <span className={`toggle-switch-label ${inputFormat === 'decimal' ? 'active' : ''}`}>Decimal</span>
        <div
          className={`toggle-switch-track ${inputFormat === 'binary' ? 'active' : ''}`}
          onClick={toggleFormat}
          role="switch"
          aria-checked={inputFormat === 'binary'}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault()
              toggleFormat()
            }
          }}
        >
          <div className="toggle-switch-thumb" />
        </div>
        <span className={`toggle-switch-label ${inputFormat === 'binary' ? 'active' : ''}`}>Binary</span>
      </div>

      <div className="input-row">
        <div className="input-group" style={{ flex: 1 }}>
          <label className="input-label">{fields[0]}</label>
          <input
            type="text"
            className="input-field"
            placeholder={inputFormat === 'decimal' ? 'e.g. 5' : 'e.g. 0101'}
            value={leftValue}
            onChange={(e) => setLeftValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && compute()}
          />
        </div>
        <div className="input-group" style={{ flex: 1 }}>
          <label className="input-label">{fields[1]}</label>
          <input
            type="text"
            className="input-field"
            placeholder={inputFormat === 'decimal' ? 'e.g. 3' : 'e.g. 0011'}
            value={rightValue}
            onChange={(e) => setRightValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && compute()}
          />
        </div>
        <div className="input-group" style={{ flex: 0.7 }}>
          <label className="input-label">Mode</label>
          <select
            className="select-field input-field"
            value={mode}
            onChange={(e) => setMode(e.target.value as 'unsigned' | 'signed')}
          >
            <option value="unsigned">Unsigned</option>
            <option value="signed">Signed</option>
          </select>
        </div>
        <div className="input-group" style={{ flex: 0.5 }}>
          <label className="input-label">Bit Size</label>
          <input
            type="number"
            className="input-field"
            min="2"
            max="1024"
            placeholder="8"
            value={bitSize}
            onChange={(e) => setBitSize(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && compute()}
          />
        </div>
      </div>

      <button className="btn-primary" onClick={compute}>Compute</button>
      <ErrorMessage message={error} />
    </div>
  )
}
