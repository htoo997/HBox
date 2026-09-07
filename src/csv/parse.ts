export type CsvRow = Record<string, string>

export type CsvParseResult =
  | { ok: true; headers: string[]; rows: CsvRow[]; delimiter: string }
  | { ok: false; message: string }

const CSV_TYPES = new Set(['text/csv', 'text/tab-separated-values', 'application/vnd.ms-excel'])
const CSV_EXTENSIONS = ['.csv', '.tsv']

export function isCsvFile(file: File) {
  if (CSV_TYPES.has(file.type.toLowerCase())) return true
  const name = file.name.toLowerCase()
  return CSV_EXTENSIONS.some((ext) => name.endsWith(ext))
}

export function jsonFileName(originalName: string) {
  const trimmed = originalName.trim() || 'data.csv'
  return `${trimmed.replace(/\.[^.]+$/, '') || 'data'}.json`
}

function detectDelimiter(text: string) {
  const firstLine = firstUnquotedLine(text)
  const counts = [
    { delimiter: ',', count: countUnquoted(firstLine, ',') },
    { delimiter: ';', count: countUnquoted(firstLine, ';') },
    { delimiter: '\t', count: countUnquoted(firstLine, '\t') },
  ]
  counts.sort((a, b) => b.count - a.count)
  const best = counts[0]
  return best && best.count > 0 ? best.delimiter : ','
}

function firstUnquotedLine(text: string) {
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (!quoted && char === '\n') return text.slice(0, index)
  }
  return text
}

function countUnquoted(text: string, delimiter: string) {
  let quoted = false
  let count = 0
  for (const char of text) {
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (!quoted && char === delimiter) count += 1
  }
  return count
}

function parseRecords(text: string, delimiter: string) {
  const records: string[][] = []
  let fields: string[] = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"'
        index += 1
        continue
      }
      if (char === '"') {
        quoted = false
        continue
      }
      field += char
      continue
    }

    if (char === '"') {
      quoted = true
      continue
    }
    if (char === delimiter) {
      fields.push(field)
      field = ''
      continue
    }
    if (char === '\n') {
      fields.push(field)
      field = ''
      if (fields.some((value) => value.length > 0)) records.push(fields)
      fields = []
      continue
    }
    field += char
  }

  fields.push(field)
  if (fields.some((value) => value.length > 0)) records.push(fields)
  return records
}

function uniqueHeaders(raw: string[]) {
  const used = new Map<string, number>()
  return raw.map((value, index) => {
    const base = value.trim() || `column_${index + 1}`
    const seen = used.get(base) ?? 0
    used.set(base, seen + 1)
    return seen === 0 ? base : `${base}_${seen + 1}`
  })
}

export function parseCsv(input: string): CsvParseResult {
  const text = input.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (!text.trim()) {
    return { ok: false, message: 'This CSV is empty.' }
  }

  const delimiter = detectDelimiter(text)
  const records = parseRecords(text, delimiter)
  const headerRecord = records[0]
  if (!headerRecord?.length) {
    return { ok: false, message: 'Could not read a header row.' }
  }
  if (records.length < 2) {
    return { ok: false, message: 'Need a header row and at least one data row.' }
  }

  const headers = uniqueHeaders(headerRecord)
  const rows = records.slice(1).map((record) => {
    const row: CsvRow = {}
    for (let index = 0; index < headers.length; index += 1) {
      const header = headers[index]
      if (!header) continue
      row[header] = record[index] ?? ''
    }
    return row
  })

  return { ok: true, headers, rows, delimiter }
}

export function toJson(rows: CsvRow[], pretty: boolean) {
  return pretty ? JSON.stringify(rows, null, 2) : JSON.stringify(rows)
}
