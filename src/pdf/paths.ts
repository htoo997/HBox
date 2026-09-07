import { existsSync } from 'node:fs'
import { basename, dirname, extname, isAbsolute, join, parse, resolve } from 'node:path'

export function initialPdfArg(): string {
  const args = process.argv.slice(2).filter((arg) => arg !== '--' && !arg.startsWith('-'))
  return args[0] ?? ''
}

export function expandPath(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('~')) {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? ''
    return resolve(trimmed.replace(/^~(?=$|[\\/])/, home))
  }
  return isAbsolute(trimmed) ? resolve(trimmed) : resolve(process.cwd(), trimmed)
}

export function defaultOutputPath(input: string): string {
  const absolute = expandPath(input)
  if (!absolute) return ''
  const { dir, name, ext } = parse(absolute)
  const suffix = ext.toLowerCase() === '.pdf' ? ext : '.pdf'
  return join(dir, `${name}-unlocked${suffix}`)
}

export function displayPath(absolute: string): string {
  const home = process.env.HOME ?? process.env.USERPROFILE
  if (home && (absolute === home || absolute.startsWith(`${home}/`) || absolute.startsWith(`${home}\\`))) {
    return `~${absolute.slice(home.length)}`
  }
  const cwd = process.cwd()
  if (absolute === cwd) return '.'
  if (absolute.startsWith(`${cwd}/`) || absolute.startsWith(`${cwd}\\`)) {
    return absolute.slice(cwd.length + 1)
  }
  return absolute
}

export function isPdfPath(filePath: string): boolean {
  return extname(filePath).toLowerCase() === '.pdf'
}

export function uniqueOutputPath(desired: string): string {
  if (!existsSync(desired)) return desired
  const dir = dirname(desired)
  const ext = extname(desired) || '.pdf'
  const name = basename(desired, ext)
  let index = 2
  while (existsSync(join(dir, `${name}-${index}${ext}`))) {
    index += 1
  }
  return join(dir, `${name}-${index}${ext}`)
}
