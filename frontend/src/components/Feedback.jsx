export default function Feedback({ type, children }) {
  if (!children) return null;
  return <div className={`feedback feedback-${type}`} role={type === 'error' ? 'alert' : 'status'}>{children}</div>;
}
