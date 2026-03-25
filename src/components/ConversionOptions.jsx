const DPI_PRESETS = [72, 150, 200, 300]

/**
 * Conversion settings panel.
 *
 * Props:
 *  options: { dpi, format, quality, startPage, endPage, extractText, useOcr }
 *  onChange(patch)
 *  pageCount: number | null
 *  disabled: boolean
 */
export default function ConversionOptions({ options, onChange, pageCount, disabled }) {
  const { dpi, format, quality, startPage, endPage, extractText, useOcr } = options

  const handleDpi = (e) => {
    const v = Number(e.target.value)
    if (!isNaN(v) && v >= 50 && v <= 400) onChange({ dpi: v })
  }
  const handleDpiBlur = (e) => {
    const v = Math.min(400, Math.max(50, Number(e.target.value) || 150))
    onChange({ dpi: v })
  }
  const handleFormat = (e) => onChange({ format: e.target.value })
  const handleQuality = (e) => onChange({ quality: Number(e.target.value) })
  const handleStart = (e) => {
    const v = Math.max(1, Number(e.target.value))
    onChange({ startPage: v, endPage: endPage && endPage < v ? v : endPage })
  }
  const handleEnd = (e) => {
    const raw = e.target.value
    if (raw === '') { onChange({ endPage: null }); return }
    const v = Math.max(startPage, Number(raw))
    onChange({ endPage: pageCount ? Math.min(v, pageCount) : v })
  }
  const handleText = (e) => onChange({ extractText: e.target.checked })
  const handleOcr = (e) => onChange({ useOcr: e.target.checked })

  const qualityPct = Math.round(quality * 100)

  return (
    <section className="options" aria-label="Conversion options">
      <h2 className="options__title">Options</h2>

      <div className="options__grid">
        {/* DPI */}
        <label className="option-label" htmlFor="dpi-input">
          Render DPI
        </label>
        <div className="option-control">
          <div className="dpi-row">
            <input
              id="dpi-input"
              type="number"
              min={50}
              max={400}
              step={1}
              value={dpi}
              onChange={handleDpi}
              onBlur={handleDpiBlur}
              disabled={disabled}
              className="dpi-input"
              aria-label="Render DPI"
            />
            <div className="dpi-presets">
              {DPI_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`dpi-preset-btn${dpi === preset ? ' dpi-preset-btn--active' : ''}`}
                  onClick={() => onChange({ dpi: preset })}
                  disabled={disabled}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
          <span className="option-hint">
            {dpi <= 96 ? 'Draft — fastest, smallest files.' : dpi <= 150 ? 'Standard — good balance of quality and size.' : dpi <= 200 ? 'High — sharp text and diagrams.' : 'Max — slowest, largest files. Best for detailed diagrams.'}
            {' '}Range: 50–400.
          </span>
        </div>

        {/* Format */}
        <label className="option-label">Image format</label>
        <div className="option-control option-control--row">
          <label className="radio-label">
            <input
              type="radio"
              name="format"
              value="jpeg"
              checked={format === 'jpeg'}
              onChange={handleFormat}
              disabled={disabled}
            />
            JPG
          </label>
          <label className="radio-label">
            <input
              type="radio"
              name="format"
              value="webp"
              checked={format === 'webp'}
              onChange={handleFormat}
              disabled={disabled}
            />
            WebP
          </label>
          <label className="radio-label">
            <input
              type="radio"
              name="format"
              value="png"
              checked={format === 'png'}
              onChange={handleFormat}
              disabled={disabled}
            />
            PNG
          </label>
          <span className="option-hint">
            {format === 'jpeg'
              ? 'Recommended — 5–10× smaller files than PNG.'
              : format === 'webp'
              ? 'Best compression — 25–35% smaller than JPG at same quality.'
              : 'Lossless — larger files, best for diagrams/text.'}
          </span>
        </div>

        {/* Quality slider — shown for lossy formats (jpeg / webp) */}
        {(format === 'jpeg' || format === 'webp') && (
          <>
            <label className="option-label" htmlFor="quality-slider">
              {format === 'webp' ? 'WebP quality' : 'JPEG quality'}
            </label>
            <div className="option-control">
              <div className="quality-row">
                <input
                  id="quality-slider"
                  type="range"
                  min={0.5}
                  max={1}
                  step={0.01}
                  value={quality}
                  onChange={handleQuality}
                  disabled={disabled}
                  className="quality-slider"
                />
                <span className="quality-value">{qualityPct}%</span>
              </div>
              <span className="option-hint">
                {qualityPct >= 90
                  ? 'Near-lossless — large files.'
                  : qualityPct >= 75
                  ? 'Good balance of quality and size.'
                  : 'Small files — some visible compression.'}
              </span>
            </div>
          </>
        )}

        {/* Page range */}
        <label className="option-label">Page range</label>
        <div className="option-control option-control--row">
          <label className="sr-only" htmlFor="start-page">From page</label>
          <input
            id="start-page"
            type="number"
            min={1}
            max={pageCount ?? 9999}
            value={startPage}
            onChange={handleStart}
            disabled={disabled}
            className="page-input"
            aria-label="From page"
          />
          <span className="page-sep">to</span>
          <label className="sr-only" htmlFor="end-page">To page</label>
          <input
            id="end-page"
            type="number"
            min={startPage}
            max={pageCount ?? 9999}
            value={endPage ?? ''}
            placeholder={pageCount ? String(pageCount) : 'last'}
            onChange={handleEnd}
            disabled={disabled}
            className="page-input"
            aria-label="To page"
          />
          {pageCount && (
            <span className="option-hint">&nbsp;of {pageCount}</span>
          )}
        </div>

        {/* Text extraction */}
        <label className="option-label" htmlFor="extract-text">
          Extract text
        </label>
        <div className="option-control option-control--row">
          <input
            id="extract-text"
            type="checkbox"
            checked={extractText}
            onChange={handleText}
            disabled={disabled}
          />
          <span className="option-hint">
            Saves per-page text in <code>text/</code> folder (text-based PDFs only).
          </span>
        </div>

        {/* OCR */}
        <label className="option-label" htmlFor="use-ocr">
          OCR fallback
        </label>
        <div className="option-control option-control--row">
          <input
            id="use-ocr"
            type="checkbox"
            checked={useOcr}
            onChange={handleOcr}
            disabled={disabled}
          />
          <span className="option-hint">
            Run OCR on image-only pages to extract text from scanned PDFs.
            Requires an internet connection to download the language model (~10 MB).
          </span>
        </div>
      </div>
    </section>
  )
}
