# HBox

A browser toolbox of local PDF utilities. Files stay on your device.

## Tools

- **PDF Unlock** — remove a known password from PDFs you own
- **PDF Merge** — combine multiple PDFs into one file
- **Image to PDF** — turn WEBP, JPG, PNG, and JPEG images into a PDF
- **PDF Sign** — draw or upload a signature and place it on any PDF pages you choose

## Run

```sh
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

## Deploy

The web app is a static Vite build. On Vercel, use:

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Node.js:** `24.x`

Tool routes such as `/tools/pdf-sign` are rewritten to `index.html` via `vercel.json`.

## Stack

- Vue 3
- Vue Router
- Vite
- [MuPDF.js](https://www.npmjs.com/package/mupdf) (AGPL-3.0)
