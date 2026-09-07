export type Tool = {
  id: string
  name: string
  description: string
  to: string
  accent: string
}

export const tools: Tool[] = [
  {
    id: 'pdf-unlock',
    name: 'PDF Unlock',
    description: 'Remove a known password from PDFs you own.',
    to: '/tools/pdf-unlock',
    accent: '#42b883',
  },
  {
    id: 'pdf-merge',
    name: 'PDF Merge',
    description: 'Combine multiple PDFs into one file, in the order you choose.',
    to: '/tools/pdf-merge',
    accent: '#89b4fa',
  },
  {
    id: 'image-to-pdf',
    name: 'Image to PDF',
    description: 'Turn WEBP, JPG, PNG, and JPEG images into a PDF.',
    to: '/tools/image-to-pdf',
    accent: '#cba6f7',
  },
  {
    id: 'pdf-sign',
    name: 'PDF Sign',
    description: 'Draw or upload a signature and place it on any PDF pages you choose.',
    to: '/tools/pdf-sign',
    accent: '#fab387',
  },
  {
    id: 'csv-to-json',
    name: 'CSV to JSON',
    description: 'Preview a CSV as a table and JSON, then download the file.',
    to: '/tools/csv-to-json',
    accent: '#94e2d5',
  },
]
