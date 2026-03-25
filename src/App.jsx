import { useCallback, useEffect, useRef, useState } from 'react'
import DropZone from './components/DropZone.jsx'
import FileInfo from './components/FileInfo.jsx'
import ConversionOptions from './components/ConversionOptions.jsx'
import ProgressBar from './components/ProgressBar.jsx'
import { loadPdf, processPdf } from './utils/pdfProcessor.js'
import { buildAndDownloadZip, downloadTextFile } from './utils/zipBuilder.js'
import { sanitiseName } from './utils/markdownGenerator.js'

const DEFAULT_OPTIONS = { dpi: 150, format: 'jpeg', quality: 0.82, startPage: 1, endPage: null, extractText: true, useOcr: false }

function classifyError(err) {
  const msg = (err?.message ?? '').toLowerCase()
  if (msg.includes('password') || msg.includes('encrypted'))
    return 'This PDF is password-protected. Remove the password and try again.'
  if (msg.includes('invalid pdf') || msg.includes('not a pdf') || msg.includes('missing pdf'))
    return 'The file does not appear to be a valid PDF. Make sure it is not corrupted.'
  if (msg.includes('out of memory') || msg.includes('allocation failed') || msg.includes('quota'))
    return 'The browser ran out of memory. Try selecting a smaller page range or reducing the DPI.'
  if (msg.includes('worker') || msg.includes('pdf.js'))
    return 'The PDF rendering engine failed to start. Try reloading the page.'
  if (msg.includes('toBlob') || msg.includes('canvas'))
    return 'Image rendering failed. Your browser may not support this image format — try switching to JPG.'
  if (msg.includes('network') || msg.includes('fetch'))
    return 'A network error occurred while loading a resource. Check your connection and try again.'
  return err?.message
    ? `Conversion failed: ${err.message}`
    : 'Conversion failed. Try reducing the page range or DPI, then try again.'
}
const LARGE_PDF_THRESHOLD = 150

// Conversion state machine
const STATE = { IDLE: 'idle', LOADED: 'loaded', CONVERTING: 'converting', DONE: 'done', ERROR: 'error' }

export default function App() {
  const [phase, setPhase] = useState(STATE.IDLE)
  const [file, setFile] = useState(null)
  const [pageCount, setPageCount] = useState(null)
  const [options, setOptions] = useState(DEFAULT_OPTIONS)
  const [progress, setProgress] = useState({ pct: 0, label: '' })
  const [error, setError] = useState(null)
  const [exports, setExports] = useState(null) // { mdContent, mrcfContent, docName }
  const cancelRef = useRef(false)

  // Load PDF metadata when file changes
  useEffect(() => {
    if (!file) return
    let cancelled = false
    setPageCount(null)
    setPhase(STATE.LOADED)
    ;(async () => {
      try {
        const buf = await file.arrayBuffer()
        const pdf = await loadPdf(buf)
        if (!cancelled) {
          setPageCount(pdf.numPages)
          setOptions((o) => ({ ...o, startPage: 1, endPage: null }))
        }
      } catch {
        // Non-fatal: we'll just not know page count ahead of time
      }
    })()
    return () => { cancelled = true }
  }, [file])

  const handleFile = useCallback((f) => {
    setFile(f)
    setPhase(STATE.LOADED)
    setError(null)
    cancelRef.current = false
  }, [])

  const handleClear = useCallback(() => {
    setFile(null)
    setPageCount(null)
    setPhase(STATE.IDLE)
    setError(null)
    setProgress({ pct: 0, label: '' })
    setExports(null)
    cancelRef.current = false
  }, [])

  const handleOptionsChange = useCallback((patch) => {
    setOptions((o) => ({ ...o, ...patch }))
  }, [])

  const handleConvert = useCallback(async () => {
    if (!file) return
    cancelRef.current = false
    setPhase(STATE.CONVERTING)
    setError(null)
    setProgress({ pct: 0, label: 'Loading PDF…' })

    try {
      const buf = await file.arrayBuffer()
      const docName = sanitiseName(file.name)

      // --- Page rendering ---
      const { pages, pageCount: total } = await processPdf(buf, {
        dpi: options.dpi,
        format: options.format,
        quality: options.quality,
        startPage: options.startPage,
        endPage: options.endPage,
        extractText: options.extractText,
        useOcr: options.useOcr,
        onCancel: () => cancelRef.current,
        onProgress: (current, total_, label) => {
          const renderPct = Math.round((current / total_) * 75)
          setProgress({ pct: renderPct, label })
        },
      })

      if (cancelRef.current) {
        setPhase(STATE.LOADED)
        setProgress({ pct: 0, label: '' })
        return
      }

      // --- ZIP assembly ---
      setProgress({ pct: 75, label: 'Building ZIP…' })

      const result = await buildAndDownloadZip({
        docName,
        originalName: file.name,
        totalPages: total,
        pages,
        dpi: options.dpi,
        format: options.format,
        ocrUsed: options.useOcr,
        onProgress: (pct, label) => setProgress({ pct: 75 + Math.round(pct * 0.25), label }),
      })
      setExports(result)

      setPhase(STATE.DONE)
      setProgress({ pct: 100, label: 'Done! Your ZIP is downloading.' })
    } catch (err) {
      console.error(err)
      setError(classifyError(err))
      setPhase(STATE.ERROR)
    }
  }, [file, options])

  const handleCancel = useCallback(() => {
    cancelRef.current = true
  }, [])

  const isConverting = phase === STATE.CONVERTING
  const isDone = phase === STATE.DONE
  const hasFile = phase !== STATE.IDLE

  const rangePages =
    pageCount
      ? (options.endPage ?? pageCount) - options.startPage + 1
      : null

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">
          <span className="app__title-icon">📄</span>
          PDF to IDE
        </h1>
        <p className="app__subtitle">
          Convert any PDF into a Cursor-ready package — page images, Markdown index, manifest.
          <br />
          <strong>100% client-side.</strong> Your file never leaves your browser.
        </p>
      </header>

      <main className="app__main">
        {!hasFile ? (
          <DropZone onFile={handleFile} disabled={isConverting} />
        ) : (
          <>
            <FileInfo
              file={file}
              pageCount={pageCount}
              onClear={handleClear}
              disabled={isConverting}
            />
            {pageCount && pageCount > LARGE_PDF_THRESHOLD && (
              <div className="warning-box">
                <span>⚠️</span>
                <span>
                  This PDF has <strong>{pageCount} pages</strong>. Processing all pages may be slow
                  or run out of browser memory. Consider setting a page range above.
                </span>
              </div>
            )}
            <ConversionOptions
              options={options}
              onChange={handleOptionsChange}
              pageCount={pageCount}
              disabled={isConverting}
            />
          </>
        )}

        {/* Action button */}
        {hasFile && !isConverting && !isDone && (
          <button className="btn btn--primary btn--lg" onClick={handleConvert} type="button">
            Convert & Download ZIP
            {rangePages ? ` (${rangePages} page${rangePages !== 1 ? 's' : ''})` : ''}
          </button>
        )}

        {/* Progress */}
        {isConverting && (
          <ProgressBar pct={progress.pct} label={progress.label} onCancel={handleCancel} />
        )}

        {/* Done */}
        {isDone && (
          <div className="result-box result-box--success">
            <span className="result-box__icon">✅</span>
            <div>
              <strong>Conversion complete!</strong>
              <p>Your ZIP is downloading. Unzip it and open the folder in Cursor or VS Code.</p>
              {exports && (
                <div className="result-box__extras">
                  <button
                    className="btn btn--ghost btn--sm"
                    type="button"
                    onClick={() => downloadTextFile(exports.mdContent, 'index.md')}
                  >
                    Download index.md
                  </button>
                  <button
                    className="btn btn--ghost btn--sm"
                    type="button"
                    onClick={() => downloadTextFile(exports.mrcfContent, `${exports.docName}.mrcf`)}
                  >
                    Download .mrcf
                  </button>
                </div>
              )}
              <button className="btn btn--ghost" onClick={handleClear} type="button">
                Convert another
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {phase === STATE.ERROR && (
          <div className="result-box result-box--error">
            <span className="result-box__icon">⚠️</span>
            <div>
              <strong>Something went wrong</strong>
              <p>{error}</p>
            </div>
            <button className="btn btn--ghost" onClick={() => setPhase(STATE.LOADED)} type="button">
              Try again
            </button>
          </div>
        )}
      </main>

      <footer className="app__footer">
        <p>
          Built with{' '}
          <a href="https://mozilla.github.io/pdf.js/" target="_blank" rel="noopener noreferrer">
            pdf.js
          </a>
          {' '}+{' '}
          <a href="https://stuk.github.io/jszip/" target="_blank" rel="noopener noreferrer">
            JSZip
          </a>
          . Output follows the{' '}
          <a href="https://github.com/player11en/MRCF-Protocol" target="_blank" rel="noopener noreferrer">
            MRCF Protocol
          </a>
          . No server. No storage. No tracking.
        </p>
      </footer>
    </div>
  )
}
