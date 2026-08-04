import { useState } from 'react'
import ErrorMessage from './ErrorMessage'

interface BinaryOperationFormProps {
  title: string
  fields: [string, string]
}

export default function BinaryOperationForm({ title, fields }: BinaryOperationFormProps) {
  const [inputFormat, setInputFormat] = useState<'decimal' | 'binary'>('decimal')
  const [leftValue, setLeftValue] = useState('')
  const [rightValue, setRightValue] = useState('')
  const [bitSize, setBitSize] = useState('8')

  const toggleFormat = () => setInputFormat(inputFormat === 'decimal' ? 'binary' : 'decimal')

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
  )
}
