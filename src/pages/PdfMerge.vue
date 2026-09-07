<script setup lang="ts">
import { computed, ref } from 'vue'
import { inspectPdfBytes } from '../pdf/core'
import { downloadPdf, isPdfFile } from '../pdf/download'
import { mergePdfBytes } from '../pdf/merge'

type QueueItem = {
  id: string
  name: string
  bytes: Uint8Array
  pages: number
  blocked: string | null
}

const items = ref<QueueItem[]>([])
const busy = ref(false)
const dragging = ref(false)
const error = ref('')
const success = ref('')
let nextId = 1

const totalPages = computed(() => items.value.reduce((sum, item) => sum + item.pages, 0))
const canMerge = computed(() => !busy.value && items.value.length >= 2 && items.value.every((item) => !item.blocked))

const statusText = computed(() => {
  if (!items.value.length) return 'Drop two or more PDFs. Merge stays on this device.'
  if (items.value.some((item) => item.blocked)) return 'Unlock password-protected files before merging.'
  if (items.value.length === 1) return 'Add another PDF to merge.'
  return `${items.value.length} files · ${totalPages.value} page${totalPages.value === 1 ? '' : 's'}`
})

async function addFiles(list: FileList | File[] | undefined) {
  if (!list?.length) return
  error.value = ''
  success.value = ''

  for (const file of Array.from(list)) {
    if (!isPdfFile(file)) {
      error.value = `${file.name} is not a PDF.`
      continue
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const result = await inspectPdfBytes(bytes, file.name)
    if (!result.ok) {
      error.value = result.message
      continue
    }

    items.value.push({
      id: String(nextId++),
      name: file.name,
      bytes,
      pages: result.info.pages,
      blocked: result.info.needsPassword ? 'Password protected' : null,
    })
  }
}

function onFileInput(event: Event) {
  const input = event.target as HTMLInputElement
  void addFiles(input.files ?? undefined)
  input.value = ''
}

function onDrop(event: DragEvent) {
  dragging.value = false
  event.preventDefault()
  void addFiles(event.dataTransfer?.files)
}

function move(index: number, step: -1 | 1) {
  const target = index + step
  if (target < 0 || target >= items.value.length) return
  const copy = items.value.slice()
  const [item] = copy.splice(index, 1)
  if (!item) return
  copy.splice(target, 0, item)
  items.value = copy
}

function remove(index: number) {
  items.value.splice(index, 1)
  success.value = ''
}

async function merge() {
  if (!canMerge.value) return
  busy.value = true
  error.value = ''
  success.value = ''

  const result = await mergePdfBytes(items.value.map((item) => ({ name: item.name, bytes: item.bytes })))
  busy.value = false

  if (!result.ok) {
    error.value = result.message
    return
  }

  downloadPdf(result.bytes, 'merged.pdf')
  success.value = `Merged ${result.pages} page${result.pages === 1 ? '' : 's'} into merged.pdf`
}
</script>

<template>
  <main class="page">
    <section class="card wide">
      <p class="eyebrow">PDF</p>
      <h1>Merge</h1>
      <p class="lede">
        Combine PDFs into one file. Drag to add files, then reorder them before downloading.
      </p>

      <label
        class="dropzone"
        :class="{ dragging, filled: items.length > 0 }"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop="onDrop"
      >
        <input type="file" accept="application/pdf,.pdf" multiple @change="onFileInput" />
        <span>Drop PDFs here, or click to add files</span>
      </label>

      <ul v-if="items.length" class="queue">
        <li v-for="(item, index) in items" :key="item.id">
          <div>
            <strong>{{ item.name }}</strong>
            <small v-if="item.blocked" class="warn">{{ item.blocked }}</small>
            <small v-else>{{ item.pages }} page{{ item.pages === 1 ? '' : 's' }}</small>
          </div>
          <div class="actions">
            <button type="button" :disabled="index === 0" @click="move(index, -1)">Up</button>
            <button type="button" :disabled="index === items.length - 1" @click="move(index, 1)">Down</button>
            <button type="button" @click="remove(index)">Remove</button>
          </div>
        </li>
      </ul>

      <p class="status" :class="{ error: !!error, ok: !!success }">
        {{ error || success || statusText }}
      </p>

      <button class="btn" type="button" :disabled="!canMerge" @click="merge">
        {{ busy ? 'Merging…' : 'Merge and download' }}
      </button>
    </section>
  </main>
</template>
