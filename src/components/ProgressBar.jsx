/**
 * Progress bar + status label.
 *
 * Props:
 *  pct: number (0–100)
 *  label: string
 *  onCancel: () => void
 */
export default function ProgressBar({ pct, label, onCancel }) {
  return (
    <div className="progress-wrap" role="status" aria-live="polite">
      <div className="progress-bar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress-bar__fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="progress-info">
        <span className="progress-label">{label}</span>
        <span className="progress-pct">{pct}%</span>
      </div>
      {onCancel && pct < 100 && (
        <button className="btn btn--ghost btn--sm" onClick={onCancel} type="button">
          Cancel
        </button>
      )}
    </div>
  )
}
