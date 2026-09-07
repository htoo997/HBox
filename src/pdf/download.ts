export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function isPdfFile(file: File) {
  return file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf'
}
