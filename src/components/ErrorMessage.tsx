interface ErrorMessageProps {
  message: string;
}

export default function ErrorMessage({ message }: ErrorMessageProps) {
  if (!message) return null;

  return (
    <div className="error-message">
      <span className="error-icon">⚠</span>
      <span>{message}</span>
    </div>
  );
}
