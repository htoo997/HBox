<script setup lang="ts">
import { computed, ref } from 'vue'
import { downloadPdf } from '../pdf/download'
import { imagesToPdfBytes, inspectImageBytes, isImageFile } from '../pdf/images-to-pdf'

type QueueItem = {
  id: string
  name: string
  bytes: Uint8Array
  width: number
  height: number
}

const items = ref<QueueItem[]>([])
const busy = ref(false)
const dragging = ref(false)
const error = ref('')
const success = ref('')
let nextId = 1

const canConvert = computed(() => !busy.value && items.value.length > 0)

const statusText = computed(() => {
  if (!items.value.length) return 'Drop WEBP, JPG, PNG, or JPEG files. Conversion stays on this device.'
  return `${items.value.length} image${items.value.length === 1 ? '' : 's'} · ${items.value.length} PDF page${items.value.length === 1 ? '' : 's'}`
})

async function addFiles(list: FileList | File[] | undefined) {
  if (!list?.length) return
  error.value = ''
  success.value = ''

  for (const file of Array.from(list)) {
    if (!isImageFile(file)) {
      error.value = `${file.name} is not a WEBP, JPG, PNG, or JPEG file.`
      continue
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    try {
      const size = await inspectImageBytes(bytes)
      items.value.push({
        id: String(nextId++),
        name: file.name,
        bytes,
        width: size.width,
        height: size.height,
      })
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : `Could not read ${file.name}.`
    }
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

async function convert() {
  if (!canConvert.value) return
  busy.value = true
  error.value = ''
  success.value = ''

  const result = await imagesToPdfBytes(items.value.map((item) => ({ name: item.name, bytes: item.bytes })))
  busy.value = false

  if (!result.ok) {
    error.value = result.message
    return
  }

  const first = items.value[0]
  const filename =
    items.value.length === 1 && first ? `${first.name.replace(/\.[^.]+$/, '')}.pdf` : 'images.pdf'
  downloadPdf(result.bytes, filename)
  success.value = `Created ${filename} with ${result.pages} page${result.pages === 1 ? '' : 's'}`
}
</script>

<template>
  <main class="page">
    <section class="card wide">
      <p class="eyebrow">Image</p>
      <h1>To PDF</h1>
      <p class="lede">
        Convert WEBP, JPG, PNG, and JPEG images into a PDF. Each image becomes one page, in the order you choose.
      </p>

      <label
        class="dropzone"
        :class="{ dragging, filled: items.length > 0 }"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop="onDrop"
      >
        <input
          type="file"
          accept="image/webp,image/jpeg,image/png,.webp,.jpg,.jpeg,.png"
          multiple
          @change="onFileInput"
        />
        <span>Drop images here, or click to add files</span>
      </label>

      <ul v-if="items.length" class="queue">
        <li v-for="(item, index) in items" :key="item.id">
          <div>
            <strong>{{ item.name }}</strong>
            <small>{{ item.width }} × {{ item.height }}</small>
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

      <button class="btn" type="button" :disabled="!canConvert" @click="convert">
        {{ busy ? 'Creating PDF…' : 'Create PDF and download' }}
      </button>
    </section>
  </main>
</template>
