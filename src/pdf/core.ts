import mupdf, { type Document as MuPdfDocument } from 'mupdf'

export type PdfInfo = {
  name: string
  pages: number
  title: string | null
  encryption: string | null
  needsPassword: boolean
}

export type InspectResult =
  | { ok: true; info: PdfInfo }
  | { ok: false; message: string }

export type UnlockBytesResult =
  | { ok: true; bytes: Uint8Array; pages: number; alreadyUnlocked: boolean }
  | { ok: false; message: string }

const PDF_MAGIC = new TextEncoder().encode('%PDF-')
const SAVE_OPTIONS = 'encrypt=none,compress=yes,garbage=yes'

export function isPdfBytes(bytes: Uint8Array): boolean {
  if (bytes.length < PDF_MAGIC.length) return false
  return PDF_MAGIC.every((value, index) => bytes[index] === value)
}

function metadata(doc: MuPdfDocument, key: string): string | null {
  const value = doc.getMetaData(key)?.trim()
  return value ? value : null
}

export async function inspectPdfBytes(bytes: Uint8Array, name = 'document.pdf'): Promise<InspectResult> {
  if (!isPdfBytes(bytes)) {
    return { ok: false, message: 'That file is not a PDF.' }
  }

  let doc: MuPdfDocument | undefined
  try {
    doc = mupdf.Document.openDocument(bytes, 'application/pdf')
    const needsPassword = doc.needsPassword()
    let pages = 0
    let title: string | null = null
    let encryption: string | null = null
    if (!needsPassword) {
      pages = doc.countPages()
    }
    try {
      title = metadata(doc, 'info:Title')
      encryption = metadata(doc, 'encryption')
    } catch {
      // Encrypted files may refuse metadata until they are authenticated.
    }
    return {
      ok: true,
      info: {
        name,
        pages,
        title,
        encryption,
        needsPassword,
      },
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    }
  } finally {
    doc?.destroy()
  }
}

export async function unlockPdfBytes(bytes: Uint8Array, password: string): Promise<UnlockBytesResult> {
  if (!isPdfBytes(bytes)) {
    return { ok: false, message: 'That file is not a PDF.' }
  }

  let doc: MuPdfDocument | undefined
  try {
    doc = mupdf.Document.openDocument(bytes, 'application/pdf')
    const needsPassword = doc.needsPassword()

    if (needsPassword) {
      if (!password) {
        return { ok: false, message: 'This PDF needs a password.' }
      }
      const auth = doc.authenticatePassword(password)
      if (auth === 0) {
        return { ok: false, message: 'Wrong password.' }
      }
    }

    const pages = doc.countPages()
    const pdf = doc.asPDF()
    if (!pdf) {
      return { ok: false, message: 'Could not read this PDF.' }
    }
    const buffer = pdf.saveToBuffer(SAVE_OPTIONS)
    return {
      ok: true,
      bytes: buffer.asUint8Array(),
      pages,
      alreadyUnlocked: !needsPassword,
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    }
  } finally {
    doc?.destroy()
  }
}

export function unlockedFileName(originalName: string): string {
  const trimmed = originalName.trim() || 'document.pdf'
  if (trimmed.toLowerCase().endsWith('.pdf')) {
    return `${trimmed.slice(0, -4)}-unlocked.pdf`
  }
  return `${trimmed}-unlocked.pdf`
}
