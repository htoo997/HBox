import mupdf from 'mupdf'

export type ImageSource = {
  name: string
  bytes: Uint8Array
}

export type ImageToPdfResult =
  | { ok: true; bytes: Uint8Array; pages: number }
  | { ok: false; message: string }

const SAVE_OPTIONS = 'encrypt=none,compress=yes,garbage=yes'
const A4_SHORT = 595.28
const A4_LONG = 841.89

const IMAGE_TYPES = new Set(['image/webp', 'image/jpeg', 'image/jpg', 'image/png'])
const IMAGE_EXTENSIONS = ['.webp', '.jpg', '.jpeg', '.png']

export function isImageFile(file: File) {
  if (IMAGE_TYPES.has(file.type.toLowerCase())) return true
  const name = file.name.toLowerCase()
  return IMAGE_EXTENSIONS.some((ext) => name.endsWith(ext))
}

function fitPageSize(width: number, height: number) {
  const landscape = width > height
  const maxW = landscape ? A4_LONG : A4_SHORT
  const maxH = landscape ? A4_SHORT : A4_LONG
  const scale = Math.min(maxW / width, maxH / height, 1)
  return {
    width: Math.max(1, width * scale),
    height: Math.max(1, height * scale),
  }
}

async function rasterizeToPng(bytes: Uint8Array) {
  const bitmap = await createImageBitmap(new Blob([Uint8Array.from(bytes)]))
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw new Error('Could not read this image.')
  }
  context.drawImage(bitmap, 0, 0)
  bitmap.close()
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Could not convert this image.'))),
      'image/png',
    )
  })
  return new Uint8Array(await blob.arrayBuffer())
}

export async function openImage(bytes: Uint8Array) {
  try {
    return new mupdf.Image(bytes)
  } catch {
    return new mupdf.Image(await rasterizeToPng(bytes))
  }
}

export async function inspectImageBytes(bytes: Uint8Array) {
  const image = await openImage(bytes)
  try {
    return {
      width: image.getWidth(),
      height: image.getHeight(),
    }
  } finally {
    image.destroy()
  }
}

export async function imagesToPdfBytes(sources: ImageSource[]): Promise<ImageToPdfResult> {
  if (!sources.length) {
    return { ok: false, message: 'Add at least one image.' }
  }

  const pdf = new mupdf.PDFDocument()
  const opened: Array<{ destroy(): void }> = [pdf]

  try {
    for (const source of sources) {
      const image = await openImage(source.bytes)
      opened.push(image)
      const size = fitPageSize(image.getWidth(), image.getHeight())
      const imageObject = pdf.addImage(image)
      const resources = pdf.addObject({
        XObject: { Im0: imageObject },
      })
      const contents = `q ${size.width} 0 0 ${size.height} 0 0 cm /Im0 Do Q`
      const page = pdf.addPage([0, 0, size.width, size.height], 0, resources, contents)
      pdf.insertPage(-1, page)
    }

    const buffer = pdf.saveToBuffer(SAVE_OPTIONS)
    return {
      ok: true,
      bytes: buffer.asUint8Array(),
      pages: pdf.countPages(),
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    }
  } finally {
    for (const object of opened) object.destroy()
  }
}
