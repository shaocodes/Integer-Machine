interface BitDisplayProps {
  bits: string;
  label: string;
  highlightSignBit?: boolean;
}

export default function BitDisplay({ bits, label, highlightSignBit = false }: BitDisplayProps) {
  if (!bits) {
    return <div className="result-placeholder">Result will appear here</div>;
  }

  const length = bits.length;

  return (
    <div className="bit-display">
      <div className="bit-display-title">{label}</div>
      <div className="bit-display-row">
        {bits.split('').map((bit, index) => {
          const isSignBit = index === 0 && highlightSignBit;
          const isZero = bit === '0';
          let className = 'bit-box';
          if (isSignBit) className += ' sign-bit';
          if (isZero) className += ' zero';
          return (
            <div key={index} className={className}>
              {bit}
            </div>
          );
        })}
      </div>
      <div className="bit-positions">
        {bits.split('').map((_, index) => (
          <div key={index} className="bit-pos-label">
            {length - 1 - index}
          </div>
        ))}
      </div>
    </div>
  );
}
