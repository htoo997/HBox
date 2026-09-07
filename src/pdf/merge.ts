import mupdf from 'mupdf'
import { isPdfBytes } from './core'

export type MergeSource = {
  name: string
  bytes: Uint8Array
}

export type MergeResult =
  | { ok: true; bytes: Uint8Array; pages: number }
  | { ok: false; message: string }

const SAVE_OPTIONS = 'encrypt=none,compress=yes,garbage=yes'

export async function mergePdfBytes(sources: MergeSource[]): Promise<MergeResult> {
  if (sources.length < 2) {
    return { ok: false, message: 'Add at least two PDFs to merge.' }
  }

  const dest = new mupdf.PDFDocument()
  const opened: Array<{ destroy(): void }> = [dest]

  try {
    for (const source of sources) {
      if (!isPdfBytes(source.bytes)) {
        return { ok: false, message: `${source.name} is not a PDF.` }
      }

      const doc = mupdf.Document.openDocument(source.bytes, 'application/pdf')
      opened.push(doc)

      if (doc.needsPassword()) {
        return {
          ok: false,
          message: `${source.name} is password-protected. Unlock it first, then merge.`,
        }
      }

      const pdf = doc.asPDF()
      if (!pdf) {
        return { ok: false, message: `Could not read ${source.name}.` }
      }

      const count = pdf.countPages()
      for (let index = 0; index < count; index += 1) {
        dest.graftPage(dest.countPages(), pdf, index)
      }
    }

    const buffer = dest.saveToBuffer(SAVE_OPTIONS)
    return {
      ok: true,
      bytes: buffer.asUint8Array(),
      pages: dest.countPages(),
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    }
  } finally {
    for (const doc of opened) doc.destroy()
  }
}
