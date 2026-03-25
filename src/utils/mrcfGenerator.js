/**
 * Generates a Machine-Readable Context Format (.mrcf) document for the converted PDF.
 * Spec: https://github.com/player11en/MRCF-Protocol
 *
 * Updated for MRCF v2:
 * - metadata front-matter
 * - canonical uppercase section headings
 * - optional SUMMARY section + page references
 */

/**
 * @param {Object}       opts
 * @param {string}       opts.docName       — sanitised base name
 * @param {string}       opts.originalName  — original filename
 * @param {number}       opts.totalPages    — total pages in source PDF
 * @param {PageResult[]} opts.pages         — processed page results
 * @param {number}       opts.dpi
 * @param {string}       opts.format        — 'jpeg' | 'png' | 'webp'
 * @param {boolean}      opts.ocrUsed       — whether OCR was applied
 * @param {Date}         opts.convertedAt
 * @returns {string}
 */
export function generateMrcf({ docName, originalName, totalPages, pages, dpi, format = 'jpeg', ocrUsed = false, convertedAt }) {
  const isoDate = convertedAt.toISOString().slice(0, 10)
  const dateStr = convertedAt.toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
  const ext = format === 'jpeg' ? 'jpg' : format === 'webp' ? 'webp' : 'png'
  const exportedPages = pages.length
  const firstPage = pages[0]?.pageNumber ?? 1
  const lastPage = pages[pages.length - 1]?.pageNumber ?? totalPages
  const imageOnlyCount = pages.filter((p) => !p.hasText).length
  const hasOcrText = ocrUsed && imageOnlyCount > 0
  const openTasks = 6 + (imageOnlyCount > 0 ? 1 : 0) + (hasOcrText ? 1 : 0) + (exportedPages < totalPages ? 1 : 0)

  const taskList = [
    `- [ ] Read \`index.md\` for an overview and table of contents @ref(page-${String(firstPage).padStart(3, '0')})`,
    `- [ ] Ask the AI: "Summarize this document in 5 bullet points." @ref(page-${String(firstPage).padStart(3, '0')})`,
    `- [ ] Ask the AI: "What are the key topics covered in this document?" @ref(page-${String(firstPage).padStart(3, '0')})`,
    imageOnlyCount > 0 && !hasOcrText
      ? `- [ ] Note: ${imageOnlyCount} page(s) are image-only — no text was extracted. Consider re-converting with OCR enabled.`
      : null,
    hasOcrText
      ? `- [ ] Review OCR output in \`text/\` — verify accuracy on complex layouts`
      : null,
    exportedPages < totalPages
      ? `- [ ] This export covers pages ${firstPage}–${lastPage} of ${totalPages}. Re-convert to include remaining pages.`
      : null,
    `- [ ] Use page images in \`pages/\` to ask about diagrams, tables, or figures`,
    `- [ ] Check \`manifest.json\` for machine-readable metadata about this export`,
  ].filter(Boolean).join('\n')

  return `---
title: ${docName}
version: "2.0"
status: active
created: ${isoDate}
updated: ${isoDate}
source: pdf-to-ide@1
tags: [pdf, export, ai, sidecar]
---

# SUMMARY

[SUMMARY]
as_of: ${isoDate}
phase: Converted
health: usable
next: Open index.md and start asking questions in your IDE assistant
open_tasks: ${openTasks}
open_blockers: 0

# VISION

Convert the PDF document \`${originalName}\` into a structured, AI-readable package that
can be explored inside Cursor, VS Code, or any LLM-powered IDE. The goal is to make
every page of the document fully searchable and queryable without leaving the editor.

Success criteria:
- Every page is accessible as an image in \`pages/\`
- Every page with extractable text has a corresponding file in \`text/\`
- An AI assistant can answer questions about any part of the document
- The package is self-contained — no external dependencies required at query time

# CONTEXT

| Field | Value |
|---|---|
| Source file | \`${originalName}\` |
| Total source pages | ${totalPages} |
| Pages in this export | ${exportedPages} (pages ${firstPage}–${lastPage}) |
| Render resolution | ${dpi} DPI |
| Image format | ${ext.toUpperCase()} |
| OCR applied | ${ocrUsed ? 'Yes' : 'No'} |
| Image-only pages | ${imageOnlyCount} |
| Converted | ${dateStr} |
| Tool | pdf-to-ide |

Intended audience: developers, researchers, and AI assistants working within an IDE.
The package is 100% client-side — no data was sent to a server.

# STRUCTURE

\`\`\`
${docName}/
├── index.md          ← Human-friendly entry point with TOC and page previews
├── manifest.json     ← Machine-readable metadata (page list, format, DPI, etc.)
├── ${docName}.mrcf   ← This file — structured context for AI assistants
├── pages/
│   ├── page-001.${ext}
│   ├── page-002.${ext}
│   └── … (${exportedPages} pages total)
└── text/
    ├── page-001.txt  ← Extracted (or OCR'd) text, one file per page
    └── …
\`\`\`

Each page image is named \`page-NNN.${ext}\` with zero-padded three-digit numbering.
Text files mirror the same numbering. Pages with no extractable text have no \`text/\` entry.

To reference a specific page, use: \`pages/page-${String(firstPage).padStart(3, '0')}.${ext}\`

# PLAN

1. **Explore** — Open \`index.md\` to browse all pages and jump to sections of interest.
2. **Search** — Use your IDE's full-text search across all \`.txt\` files in \`text/\`.
3. **Ask** — Use an AI assistant to query the content (see TASKS below for prompts).
4. **Analyse** — Reference specific page images when asking about visuals or diagrams.
5. **Export** — Copy relevant sections from \`text/\` into your own notes or codebase.

# TASKS

${taskList}
`
}
