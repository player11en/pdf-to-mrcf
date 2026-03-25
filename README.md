# PDF to IDE

> Repository: **pdf-to-mrcf**

Convert any PDF into an IDE-friendly sidecar package that works well with Cursor, VS Code, and LLM assistants.

The app runs fully in the browser (client-side): no upload server, no storage, no tracking.

This repository is the technical home for the **PDF to IDE** app. It is designed as a companion tool to the MRCF ecosystem.

- MRCF Protocol: https://github.com/player11en/MRCF-Protocol
- GitHub Pages URL: https://player11en.github.io/pdf-to-mrcf/

## Features

- Drag-and-drop PDF input
- Render pages to images (`JPG`, `WebP`, or `PNG`)
- Extract per-page text (pdf.js)
- Optional OCR fallback for image-only pages (Tesseract)
- Page range export
- ZIP package generation with:
  - `index.md` (human entry point)
  - `manifest.json` (machine-readable metadata)
  - `*.mrcf` (MRCF Protocol v2 structured context)
  - `pages/` images
  - `text/` extracted text files

## Tech Stack

- React + Vite
- `pdfjs-dist` for PDF rendering and text extraction
- `tesseract.js` for optional OCR
- `jszip` for ZIP creation

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
npm install
```

### Run locally

```bash
npm run dev
```

Vite will print the local URL (configured for GitHub Pages base path `/pdf-to-mrcf/`).

### Build

```bash
npm run build
```

Build output is generated into `dist/` and is ready for GitHub Pages.

### Preview production build

```bash
npm run preview
```

## Deploy to GitHub Pages

This project is configured for GitHub Pages with Vite base path:

```js
base: '/pdf-to-mrcf/'
```

Manual deploy flow:

```bash
npm install
npm run build
```

Then publish the `dist/` content to GitHub Pages (via `gh-pages` branch or GitHub Actions).

## Usage

1. Drop a PDF into the app.
2. Set options:
   - DPI (50–400)
   - image format (JPG/WebP/PNG)
   - quality (for JPG/WebP)
   - page range
   - text extraction
   - OCR fallback (optional)
3. Click **Convert & Download ZIP**.
4. Unzip and open the folder in Cursor/VS Code.
5. Start from `index.md` or `your-doc.mrcf`.

## Output Structure

```text
your-doc/
├── index.md
├── manifest.json
├── your-doc.mrcf
├── pages/
│   ├── page-001.jpg
│   └── ...
└── text/
    ├── page-001.txt
    └── ...
```

## MRCF v2 Export Notes

The generated `.mrcf` file follows MRCF Protocol v2 conventions:

- Metadata front matter (`title`, `version`, `created`, `updated`, `status`, `source`, `tags`)
- Canonical top-level sections:
  - `# SUMMARY`
  - `# VISION`
  - `# CONTEXT`
  - `# STRUCTURE`
  - `# PLAN`
  - `# TASKS`
- `[SUMMARY]` block with export snapshot fields
- Task checkboxes with optional page references via `@ref(page-XXX)`

This keeps exports compatible with existing v1-style task tooling while improving v2 parser/AI readiness.

## Privacy

- All processing happens in the browser.
- PDFs are not uploaded by this app.
- OCR may download language model files when enabled.

## License

Internal project (no standalone license file currently defined in this folder).
