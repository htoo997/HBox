import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { inspectPdfBytes, isPdfBytes, unlockPdfBytes } from './core'
import { expandPath, isPdfPath } from './paths'

export type PdfStatus =
  | { kind: 'empty' }
  | { kind: 'missing'; path: string }
  | { kind: 'not-file'; path: string }
  | { kind: 'not-pdf'; path: string }
  | {
      kind: 'ready'
      path: string
      name: string
      pages: number
      title: string | null
      encryption: string | null
      needsPassword: boolean
      alreadyOpen: boolean
    }
  | { kind: 'error'; path: string; message: string }

export type UnlockResult =
  | { ok: true; outputPath: string; pages: number; alreadyUnlocked: boolean }
  | { ok: false; message: string }

export async function listNearbyPdfs(dir = process.cwd(), limit = 8): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isFile() && isPdfPath(entry.name))
      .map((entry) => join(dir, entry.name))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, limit)
  } catch {
    return []
  }
}

export async function inspectPdf(input: string): Promise<PdfStatus> {
  const trimmed = input.trim()
  if (!trimmed) return { kind: 'empty' }

  const path = expandPath(trimmed)
  let info
  try {
    info = await stat(path)
  } catch {
    return { kind: 'missing', path }
  }

  if (!info.isFile()) return { kind: 'not-file', path }

  const bytes = await readFile(path)
  if (!isPdfBytes(bytes)) return { kind: 'not-pdf', path }

  const result = await inspectPdfBytes(bytes, basename(path))
  if (!result.ok) {
    return { kind: 'error', path, message: result.message }
  }

  return {
    kind: 'ready',
    path,
    name: result.info.name,
    pages: result.info.pages,
    title: result.info.title,
    encryption: result.info.encryption,
    needsPassword: result.info.needsPassword,
    alreadyOpen: !result.info.needsPassword,
  }
}

export async function unlockPdf(
  input: string,
  output: string,
  password: string,
): Promise<UnlockResult> {
  const source = expandPath(input)
  const destination = expandPath(output)

  if (!source) return { ok: false, message: 'Choose a PDF to unlock.' }
  if (!destination) return { ok: false, message: 'Choose where to save the unlocked PDF.' }
  if (source === destination) {
    return { ok: false, message: 'Output path must be different from the source PDF.' }
  }

  const bytes = await readFile(source)
  const result = await unlockPdfBytes(bytes, password)
  if (!result.ok) return result

  await writeFile(destination, result.bytes)
  return {
    ok: true,
    outputPath: destination,
    pages: result.pages,
    alreadyUnlocked: result.alreadyUnlocked,
  }
}
