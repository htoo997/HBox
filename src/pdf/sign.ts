import mupdf, { type Document, type Image, type PDFPage, type Pixmap } from 'mupdf'
import { isPdfBytes } from './core'
import { openImage } from './images-to-pdf'

export type SignPlacement = {
  x: number
  y: number
  width: number
  height: number
}

export type PagePreview = {
  url: string
  width: number
  height: number
  pages: number
}

export type PageStamp = {
  pageIndex: number
  placement: SignPlacement
}

export type SignResult =
  | { ok: true; bytes: Uint8Array; pages: number; signedPages: number }
  | { ok: false; message: string }

const SAVE_OPTIONS = 'encrypt=none,compress=yes,garbage=yes'

function clampPlacement(placement: SignPlacement): SignPlacement {
  const width = Math.min(0.85, Math.max(0.08, placement.width))
  const height = Math.min(0.85, Math.max(0.04, placement.height))
  return {
    width,
    height,
    x: Math.min(1 - width, Math.max(0, placement.x)),
    y: Math.min(1 - height, Math.max(0, placement.y)),
  }
}

export function defaultSignaturePlacement(
  pageWidth: number,
  pageHeight: number,
  imageWidth: number,
  imageHeight: number,
): SignPlacement {
  const aspect = imageHeight / Math.max(1, imageWidth)
  const width = 0.28
  const height = Math.min(0.22, width * (pageWidth / Math.max(1, pageHeight)) * aspect)
  return clampPlacement({
    width,
    height,
    x: 1 - width - 0.08,
    y: 1 - height - 0.08,
  })
}

function pngUrl(bytes: Uint8Array) {
  return URL.createObjectURL(new Blob([Uint8Array.from(bytes)], { type: 'image/png' }))
}

function openPdf(bytes: Uint8Array) {
  if (!isPdfBytes(bytes)) {
    throw new Error('That file is not a PDF.')
  }
  const doc = mupdf.Document.openDocument(bytes, 'application/pdf')
  if (doc.needsPassword()) {
    doc.destroy()
    throw new Error('This PDF is password-protected. Unlock it first, then sign.')
  }
  const pdf = doc.asPDF()
  if (!pdf) {
    doc.destroy()
    throw new Error('Could not read this PDF.')
  }
  return { doc, pdf }
}

export async function renderPdfPage(bytes: Uint8Array, pageIndex: number): Promise<PagePreview> {
  const { doc, pdf } = openPdf(bytes)
  let page: PDFPage | undefined
  let pixmap: Pixmap | undefined
  try {
    const pages = pdf.countPages()
    const index = Math.min(Math.max(0, pageIndex), pages - 1)
    const loaded = pdf.loadPage(index) as PDFPage
    page = loaded
    const bounds = loaded.getBounds()
    const width = Math.max(1, bounds[2] - bounds[0])
    const height = Math.max(1, bounds[3] - bounds[1])
    const scale = Math.min(2.2, 880 / width)
    pixmap = loaded.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false, true)
    return {
      url: pngUrl(pixmap.asPNG()),
      width,
      height,
      pages,
    }
  } finally {
    pixmap?.destroy()
    page?.destroy()
    doc.destroy()
  }
}

function insertSignature(page: PDFPage, image: Image, placement: SignPlacement) {
  const bounds = page.getBounds()
  const pageWidth = Math.max(1, bounds[2] - bounds[0])
  const pageHeight = Math.max(1, bounds[3] - bounds[1])
  const box = clampPlacement(placement)
  const width = box.width * pageWidth
  const height = box.height * pageHeight
  const x = bounds[0] + box.x * pageWidth
  const y = bounds[1] + box.y * pageHeight

  const annot = page.createAnnotation('Stamp')
  annot.setRect([x, y, x + width, y + height])
  annot.setStampImage(image)
  annot.setFlags(mupdf.PDFAnnotation.IS_PRINT)
  annot.update()
  page.update()
}

export async function signPdfBytes(
  pdfBytes: Uint8Array,
  signatureBytes: Uint8Array,
  stamps: PageStamp[],
): Promise<SignResult> {
  let doc: Document | undefined
  let image: Image | undefined
  const openedPages: PDFPage[] = []
  try {
    if (!stamps.length) {
      return { ok: false, message: 'Place the signature on at least one page.' }
    }

    const opened = openPdf(pdfBytes)
    doc = opened.doc
    const pdf = opened.pdf
    const pages = pdf.countPages()
    image = await openImage(signatureBytes)

    for (const stamp of stamps) {
      if (stamp.pageIndex < 0 || stamp.pageIndex >= pages) {
        return { ok: false, message: 'That page is not in this PDF.' }
      }
      const loaded = pdf.loadPage(stamp.pageIndex) as PDFPage
      openedPages.push(loaded)
      insertSignature(loaded, image, stamp.placement)
    }

    const buffer = pdf.saveToBuffer(SAVE_OPTIONS)
    return { ok: true, bytes: buffer.asUint8Array(), pages, signedPages: stamps.length }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    }
  } finally {
    image?.destroy()
    for (const page of openedPages) page.destroy()
    doc?.destroy()
  }
}

export function signedFileName(originalName: string) {
  const trimmed = originalName.trim() || 'document.pdf'
  if (trimmed.toLowerCase().endsWith('.pdf')) {
    return `${trimmed.slice(0, -4)}-signed.pdf`
  }
  return `${trimmed}-signed.pdf`
}
