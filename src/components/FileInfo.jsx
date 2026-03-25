/**
 * Displays the selected PDF's name / size / page count.
 *
 * Props:
 *  file: File
 *  pageCount: number | null
 *  onClear: () => void
 *  disabled: boolean
 */
export default function FileInfo({ file, pageCount, onClear, disabled }) {
  const sizeMb = (file.size / 1_048_576).toFixed(2)

  return (
    <div className="file-info">
      <span className="file-info__icon">📑</span>
      <div className="file-info__meta">
        <span className="file-info__name" title={file.name}>{file.name}</span>
        <span className="file-info__sub">
          {sizeMb} MB{pageCount ? ` · ${pageCount} pages` : ''}
        </span>
      </div>
      {!disabled && (
        <button
          className="btn btn--ghost btn--sm file-info__clear"
          onClick={onClear}
          type="button"
          aria-label="Remove file"
        >
          ✕
        </button>
      )}
    </div>
  )
}
