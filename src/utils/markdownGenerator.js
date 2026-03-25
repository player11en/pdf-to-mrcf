/**
 * Generates the index.md and manifest.json content for the ZIP package.
 */

/**
 * @param {Object} opts
 * @param {string}       opts.docName       — sanitised base name of the PDF
 * @param {string}       opts.originalName  — original filename
 * @param {number}       opts.totalPages    — total pages in source PDF
 * @param {PageResult[]} opts.pages         — processed page results
 * @param {number}       opts.dpi
 * @param {Date}         opts.convertedAt
 * @returns {string}
 */
export function generateMarkdown({ docName, originalName, totalPages, pages, dpi, format = 'jpeg', convertedAt }) {
  const dateStr = convertedAt.toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
  const ext = format === 'jpeg' ? 'jpg' : format === 'webp' ? 'webp' : 'png'

  const toc = pages
    .map(
      (p) =>
        `- [Page ${p.pageNumber}](#page-${p.pageNumber}) ${p.hasText ? '' : '_(image-only)_'}`,
    )
    .join('\n')

  const pageSections = pages
    .map((p) => {
      const imgPath = `pages/page-${String(p.pageNumber).padStart(3, '0')}.${ext}`
      const txtPath = `text/page-${String(p.pageNumber).padStart(3, '0')}.txt`

      const textLine = p.hasText
        ? `📄 [Extracted text](${txtPath})`
        : `_(no extractable text — image-only page)_`

      return `## Page ${p.pageNumber}\n\n![Page ${p.pageNumber}](${imgPath})\n\n${textLine}`
    })
    .join('\n\n---\n\n')

  return `# ${docName}

> **Cursor/IDE Sidecar Package**
> Converted from \`${originalName}\` on ${dateStr}
> Pages rendered at ${dpi} DPI.

## How to use in Cursor

1. Unzip and open this folder in Cursor (File → Open Folder).
2. This file (\`index.md\`) is your entry point — open it and use Cursor's AI on it.
3. Page images live in \`pages/\` and are referenced below.
4. Extracted text lives in \`text/\` for fast search and copy.

### Example prompts to try in Cursor

- _"Summarize this document in 5 bullet points."_
- _"What does page 3 say about [topic]?"_
- _"Extract all requirements from pages 5–10."_
- _"What does the diagram on page [N] show?"_
- _"List every number, date, or table value mentioned."_
- _"Draft a response to the main argument in this document."_

## Document info

| Field | Value |
|-------|-------|
| Source file | \`${originalName}\` |
| Total pages | ${totalPages} |
| Pages in this export | ${pages.length} (pages ${pages[0].pageNumber}–${pages[pages.length - 1].pageNumber}) |
| Render DPI | ${dpi} |
| Converted | ${dateStr} |

## Table of contents

${toc}

---

${pageSections}
`
}

/**
 * @param {Object} opts
 * @param {string}       opts.docName
 * @param {string}       opts.originalName
 * @param {number}       opts.totalPages
 * @param {PageResult[]} opts.pages
 * @param {number}       opts.dpi
 * @param {Date}         opts.convertedAt
 * @returns {string} JSON string
 */
export function generateManifest({ docName, originalName, totalPages, pages, dpi, format = 'jpeg', convertedAt }) {
  const ext = format === 'jpeg' ? 'jpg' : format === 'webp' ? 'webp' : 'png'
  return JSON.stringify(
    {
      version: 1,
      tool: 'pdf-to-ide',
      source: originalName,
      docName,
      totalSourcePages: totalPages,
      exportedPages: pages.length,
      renderDpi: dpi,
      imageFormat: ext,
      convertedAt: convertedAt.toISOString(),
      pages: pages.map((p) => ({
        pageNumber: p.pageNumber,
        image: `pages/page-${String(p.pageNumber).padStart(3, '0')}.${ext}`,
        text: `text/page-${String(p.pageNumber).padStart(3, '0')}.txt`,
        hasExtractableText: p.hasText,
        textLength: p.text.length,
      })),
    },
    null,
    2,
  )
}

/**
 * Sanitise a filename to something safe for folder names and Markdown headings.
 * @param {string} filename
 * @returns {string}
 */
export function sanitiseName(filename) {
  return filename
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80)
}
