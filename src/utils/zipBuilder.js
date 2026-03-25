/**
 * Assembles the final ZIP file using JSZip.
 */

import JSZip from 'jszip'
import { generateMarkdown, generateManifest } from './markdownGenerator.js'
import { generateMrcf } from './mrcfGenerator.js'

/**
 * Build and trigger download of the sidecar ZIP.
 *
 * @param {Object}       opts
 * @param {string}       opts.docName
 * @param {string}       opts.originalName
 * @param {number}       opts.totalPages
 * @param {PageResult[]} opts.pages
 * @param {number}       opts.dpi
 * @param {Function}     opts.onProgress  — (pct: number, label: string) => void
 * @returns {Promise<void>}
 */
export async function buildAndDownloadZip(opts) {
  const { docName, originalName, totalPages, pages, dpi, format = 'jpeg', ocrUsed = false, onProgress = () => {} } = opts
  const convertedAt = new Date()
  const ext = format === 'jpeg' ? 'jpg' : format === 'webp' ? 'webp' : 'png'

  const zip = new JSZip()
  const root = zip.folder(docName)
  const pagesFolder = root.folder('pages')
  const textFolder = root.folder('text')

  onProgress(0, 'Building ZIP…')

  // Add page images and per-page text files
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i]
    const pad = String(p.pageNumber).padStart(3, '0')

    pagesFolder.file(`page-${pad}.${ext}`, p.imgBlob)

    if (p.text) {
      textFolder.file(`page-${pad}.txt`, p.text)
    }

    onProgress(Math.round(((i + 1) / pages.length) * 70), `Packing page ${i + 1} / ${pages.length}…`)
  }

  // Generate and add index + manifest + MRCF
  const mdContent = generateMarkdown({ docName, originalName, totalPages, pages, dpi, format, convertedAt })
  root.file('index.md', mdContent)

  const manifestContent = generateManifest({
    docName,
    originalName,
    totalPages,
    pages,
    dpi,
    format,
    convertedAt,
  })
  root.file('manifest.json', manifestContent)

  const mrcfContent = generateMrcf({ docName, originalName, totalPages, pages, dpi, format, ocrUsed, convertedAt })
  root.file(`${docName}.mrcf`, mrcfContent)

  onProgress(80, 'Compressing…')

  const blob = await zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (meta) => {
      onProgress(80 + Math.round(meta.percent * 0.2), 'Compressing…')
    },
  )

  onProgress(100, 'Done!')

  // Trigger download
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${docName}.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10_000)

  // Return generated text content so callers can offer individual downloads
  return { mdContent, mrcfContent, docName }
}

/**
 * Trigger a plain-text file download in the browser.
 * @param {string} content
 * @param {string} filename
 */
export function downloadTextFile(content, filename) {
  const blob = new Blob([content], { type: 'text/plain; charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
