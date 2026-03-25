/**
 * PDF Processor — renders pages to PNG blobs using pdf.js.
 * Processes pages sequentially to stay within browser memory limits.
 */

import * as pdfjsLib from 'pdfjs-dist'
import { createWorker as createTesseractWorker } from 'tesseract.js'

// Point the worker at the copy shipped in node_modules.
// Vite will resolve ?url to the public asset path at build time.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

/**
 * Load a PDF from an ArrayBuffer.
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<PDFDocumentProxy>}
 */
export async function loadPdf(arrayBuffer) {
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
  return loadingTask.promise
}

/**
 * Render a single page to an image Blob.
 * @param {PDFPageProxy} page
 * @param {number} dpi
 * @param {'jpeg'|'png'|'webp'} format
 * @param {number} quality  — 0–1, only used for jpeg/webp
 * @returns {Promise<Blob>}
 */
export async function renderPageToBlob(page, dpi, format = 'jpeg', quality = 0.82) {
  const scale = dpi / 72 // pdf.js uses 72 dpi as base
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)

  const ctx = canvas.getContext('2d')

  // JPEG and WebP need a white background (canvas default is transparent)
  if (format === 'jpeg' || format === 'webp') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  await page.render({ canvasContext: ctx, viewport }).promise

  const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png'
  const encodingQuality = (format === 'jpeg' || format === 'webp') ? quality : undefined
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      mimeType,
      encodingQuality,
    )
  })
}

/**
 * Extract properly ordered plain text from a single page.
 *
 * pdf.js gives us each text item's position via a transform matrix:
 *   [scaleX, skewX, skewY, scaleY, translateX, translateY]
 * translateY is the baseline Y in PDF coordinates (0 = bottom of page).
 *
 * Strategy:
 *  1. Filter out empty items.
 *  2. Group items into lines by rounding their Y to the nearest "bucket"
 *     sized by the item's font height (so items on the same visual line merge).
 *  3. Sort lines top-to-bottom (descending Y, since PDF Y grows upward).
 *  4. Within each line sort left-to-right (ascending X).
 *  5. Join items in a line — insert a space when there's a visible gap
 *     between consecutive items (gap > 20% of font size).
 *  6. Join lines with '\n'; double-newline when the gap between lines
 *     is more than 1.5× the average line height (paragraph break).
 *
 * @param {PDFPageProxy} page
 * @returns {Promise<string>}
 */
export async function extractPageText(page) {
  try {
    const content = await page.getTextContent({ includeMarkedContent: false })

    // Keep only real text items (MarkedContent markers have no str)
    const items = content.items.filter((item) => typeof item.str === 'string' && item.str !== '')

    if (items.length === 0) return ''

    // Build enriched item list with x, y, fontSize
    const enriched = items.map((item) => {
      const [scaleX, , , scaleY, tx, ty] = item.transform
      const fontSize = Math.abs(scaleY) || Math.abs(scaleX) || 12
      return { str: item.str, x: tx, y: ty, fontSize, width: item.width ?? 0 }
    })

    // Bucket items into lines. Use fontSize as bucket tolerance.
    // Key = Math.round(y / tolerance) so items within ~½ fontSize of each
    // other fall into the same line.
    const lineMap = new Map()
    for (const item of enriched) {
      const tolerance = Math.max(item.fontSize * 0.4, 2)
      const key = Math.round(item.y / tolerance)
      if (!lineMap.has(key)) lineMap.set(key, { y: item.y, items: [] })
      lineMap.get(key).items.push(item)
    }

    // Sort lines top-to-bottom (larger Y = higher on page in PDF coords)
    const lines = [...lineMap.values()].sort((a, b) => b.y - a.y)

    // Compute average line gap for paragraph detection
    let totalGap = 0
    let gapCount = 0
    for (let i = 1; i < lines.length; i++) {
      const gap = lines[i - 1].y - lines[i].y
      if (gap > 0) { totalGap += gap; gapCount++ }
    }
    const avgGap = gapCount > 0 ? totalGap / gapCount : 12

    const resultLines = []
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li]

      // Sort items left-to-right
      line.items.sort((a, b) => a.x - b.x)

      // Join items, inserting a space when there's a visible gap
      let lineStr = ''
      for (let ii = 0; ii < line.items.length; ii++) {
        const cur = line.items[ii]
        if (ii === 0) {
          lineStr = cur.str
          continue
        }
        const prev = line.items[ii - 1]
        const expectedNext = prev.x + prev.width
        const gap = cur.x - expectedNext
        const spaceThreshold = prev.fontSize * 0.2
        // Add a space if there's a gap, or if the previous item didn't end with one
        if (gap > spaceThreshold && !lineStr.endsWith(' ')) {
          lineStr += ' '
        }
        lineStr += cur.str
      }

      lineStr = lineStr.trim()
      if (!lineStr) continue

      // Detect paragraph break: gap to next line > 1.5× average
      const gapToNext = li < lines.length - 1 ? line.y - lines[li + 1].y : 0
      resultLines.push(lineStr)
      if (gapToNext > avgGap * 1.5) {
        resultLines.push('') // blank line = paragraph separator
      }
    }

    return resultLines.join('\n').trim()
  } catch {
    return ''
  }
}

/**
 * Main conversion pipeline — calls onProgress for each page.
 *
 * @param {ArrayBuffer}  arrayBuffer
 * @param {Object}       opts
 * @param {number}       opts.dpi          — render resolution (72–300)
 * @param {'jpeg'|'png'|'webp'} opts.format  — image format (default 'jpeg')
 * @param {number}       opts.quality      — jpeg quality 0–1 (default 0.82)
 * @param {number}       opts.startPage    — 1-based
 * @param {number|null}  opts.endPage      — 1-based, null = last page
 * @param {boolean}      opts.extractText  — include text extraction
 * @param {boolean}      opts.useOcr       — run OCR on image-only pages (requires network for language data)
 * @param {Function}     opts.onProgress   — (current, total, label) => void
 * @param {Function}     opts.onCancel     — returns true if conversion should abort
 *
 * @returns {Promise<{ pages: PageResult[], pageCount: number }>}
 */
export async function processPdf(arrayBuffer, opts) {
  const {
    dpi = 150,
    format = 'jpeg',
    quality = 0.82,
    startPage = 1,
    endPage = null,
    extractText = true,
    useOcr = false,
    onProgress = () => {},
    onCancel = () => false,
  } = opts

  const pdf = await loadPdf(arrayBuffer)
  const totalPages = pdf.numPages
  const last = Math.min(endPage ?? totalPages, totalPages)
  const first = Math.max(1, startPage)
  const rangeCount = last - first + 1

  // Initialise Tesseract worker once if OCR is enabled
  let ocrWorker = null
  if (useOcr) {
    onProgress(0, rangeCount, 'Loading OCR engine…')
    ocrWorker = await createTesseractWorker('eng')
  }

  const pages = []

  try {
    for (let pageNum = first; pageNum <= last; pageNum++) {
      if (onCancel()) break

      const index = pageNum - first + 1
      onProgress(index, rangeCount, `Rendering page ${pageNum} / ${last}…`)

      const page = await pdf.getPage(pageNum)
      const imgBlob = await renderPageToBlob(page, dpi, format, quality)
      let text = extractText ? await extractPageText(page) : ''

      // Run OCR when the page has no extractable text and OCR is enabled
      if (useOcr && ocrWorker && text.length < 20) {
        onProgress(index, rangeCount, `OCR page ${pageNum} / ${last}…`)
        try {
          const { data } = await ocrWorker.recognize(imgBlob)
          text = data.text?.trim() ?? ''
        } catch {
          // OCR failure is non-fatal — keep empty text
        }
      }

      pages.push({
        pageNumber: pageNum,
        index,
        imgBlob,
        format,
        text,
        hasText: text.length > 20,
        ocrUsed: useOcr && ocrWorker !== null,
      })

      page.cleanup()
    }
  } finally {
    if (ocrWorker) await ocrWorker.terminate()
  }

  return { pages, pageCount: totalPages }
}
