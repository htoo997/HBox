<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { inspectPdfBytes } from '../pdf/core'
import { downloadPdf, isPdfFile } from '../pdf/download'
import { inspectImageBytes, isImageFile } from '../pdf/images-to-pdf'
import {
  defaultSignaturePlacement,
  renderPdfPage,
  signedFileName,
  signPdfBytes,
  type SignPlacement,
} from '../pdf/sign'

const pdfName = ref('')
const pdfBytes = ref<Uint8Array | null>(null)
const pageIndex = ref(0)
const pages = ref(0)
const pageUrl = ref('')
const pageSize = ref({ width: 1, height: 1 })
const signatureBytes = ref<Uint8Array | null>(null)
const signatureUrl = ref('')
const signatureSize = ref({ width: 1, height: 1 })
const stamps = ref<Record<number, SignPlacement>>({})
const lastPlacement = ref<SignPlacement | null>(null)
const busy = ref(false)
const loadingPage = ref(false)
const draggingPdf = ref(false)
const draggingSign = ref(false)
const error = ref('')
const success = ref('')
const pad = ref<HTMLCanvasElement | null>(null)
const stage = ref<HTMLElement | null>(null)
const dragMode = ref<'move' | 'resize' | null>(null)
const currentStamp = computed(() => stamps.value[pageIndex.value] ?? null)
const signedPageIndexes = computed(() =>
  Object.keys(stamps.value)
    .map((key) => Number(key))
    .sort((a, b) => a - b),
)
const canSign = computed(
  () => !busy.value && !!pdfBytes.value && !!signatureBytes.value && signedPageIndexes.value.length > 0,
)

const statusText = computed(() => {
  if (!pdfBytes.value) return 'Drop a PDF, then draw or upload a signature to place on the page.'
  if (!signatureBytes.value) return 'Draw a signature or upload a PNG, JPG, JPEG, or WEBP image.'
  if (!signedPageIndexes.value.length) {
    return 'Place the signature on this page. Other pages stay unsigned until you place it there.'
  }
  const pagesLabel = formatPageList(signedPageIndexes.value)
  if (currentStamp.value) {
    return `This page will be signed · ${pagesLabel} in the download`
  }
  return `No signature on this page · ${pagesLabel} will still be signed`
})

function revoke(url: string) {
  if (url) URL.revokeObjectURL(url)
}

function formatPageList(indexes: number[]) {
  const labels = indexes.map((index) => String(index + 1))
  if (labels.length === 1) return `page ${labels[0]}`
  if (labels.length === 2) return `pages ${labels[0]} and ${labels[1]}`
  return `pages ${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`
}

function heightFromWidth(width: number) {
  const aspect = signatureSize.value.height / Math.max(1, signatureSize.value.width)
  return width * (pageSize.value.width / Math.max(1, pageSize.value.height)) * aspect
}

function fitPlacement(next: SignPlacement) {
  const width = Math.min(0.85, Math.max(0.08, next.width))
  const height = Math.min(0.85, Math.max(0.04, heightFromWidth(width)))
  const fitted = {
    width,
    height,
    x: Math.min(1 - width, Math.max(0, next.x)),
    y: Math.min(1 - height, Math.max(0, next.y)),
  }
  lastPlacement.value = fitted
  stamps.value = { ...stamps.value, [pageIndex.value]: fitted }
}

function defaultPlacement() {
  return defaultSignaturePlacement(
    pageSize.value.width,
    pageSize.value.height,
    signatureSize.value.width,
    signatureSize.value.height,
  )
}

function placeOnCurrentPage() {
  if (!signatureBytes.value) return
  fitPlacement(lastPlacement.value ?? currentStamp.value ?? defaultPlacement())
  success.value = ''
}

function removeFromCurrentPage() {
  const next = { ...stamps.value }
  delete next[pageIndex.value]
  stamps.value = next
  success.value = ''
}

function clearStamps() {
  stamps.value = {}
  lastPlacement.value = null
}

async function setSignature(bytes: Uint8Array, width: number, height: number) {
  revoke(signatureUrl.value)
  signatureBytes.value = bytes
  signatureSize.value = { width, height }
  signatureUrl.value = URL.createObjectURL(new Blob([Uint8Array.from(bytes)], { type: 'image/png' }))
  if (currentStamp.value) fitPlacement(currentStamp.value)
  else placeOnCurrentPage()
  success.value = ''
}

function setupPad() {
  const canvas = pad.value
  if (!canvas) return
  const ratio = Math.max(2, Math.min(3, window.devicePixelRatio || 1))
  canvas.width = Math.round(640 * ratio)
  canvas.height = Math.round(180 * ratio)
  const context = canvas.getContext('2d')
  if (!context) return
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.strokeStyle = '#11111b'
  context.lineWidth = 2.4 * ratio
}

function padPoint(event: PointerEvent) {
  const canvas = pad.value
  if (!canvas) return null
  const box = canvas.getBoundingClientRect()
  return {
    x: ((event.clientX - box.left) / box.width) * canvas.width,
    y: ((event.clientY - box.top) / box.height) * canvas.height,
  }
}

function canvasHasInk(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d')
  if (!context) return false
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
  for (let index = 3; index < data.length; index += 4) {
    if ((data[index] ?? 0) > 12) return true
  }
  return false
}

async function exportPad() {
  const canvas = pad.value
  if (!canvas || !canvasHasInk(canvas)) return
  const context = canvas.getContext('2d')
  if (!context) return
  const { width, height } = canvas
  const { data } = context.getImageData(0, 0, width, height)
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((data[(y * width + x) * 4 + 3] ?? 0) > 12) {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
  }
  if (maxX < 0) return
  const inset = Math.round(Math.max(width, height) * 0.03)
  const sx = Math.max(0, minX - inset)
  const sy = Math.max(0, minY - inset)
  const sw = Math.min(width - sx, maxX - minX + 1 + inset * 2)
  const sh = Math.min(height - sy, maxY - minY + 1 + inset * 2)
  const trimmed = document.createElement('canvas')
  trimmed.width = sw
  trimmed.height = sh
  const next = trimmed.getContext('2d')
  if (!next) return
  next.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh)
  const blob = await new Promise<Blob>((resolve, reject) => {
    trimmed.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Could not save the signature.'))),
      'image/png',
    )
  })
  await setSignature(new Uint8Array(await blob.arrayBuffer()), sw, sh)
}

let drawing = false
let lastPoint: { x: number; y: number } | null = null

function onPadDown(event: PointerEvent) {
  const canvas = pad.value
  const point = padPoint(event)
  if (!canvas || !point) return
  event.preventDefault()
  drawing = true
  lastPoint = point
  canvas.setPointerCapture(event.pointerId)
  error.value = ''
}

function onPadMove(event: PointerEvent) {
  if (!drawing || !lastPoint) return
  const canvas = pad.value
  const context = canvas?.getContext('2d')
  const point = padPoint(event)
  if (!canvas || !context || !point) return
  context.beginPath()
  context.moveTo(lastPoint.x, lastPoint.y)
  context.lineTo(point.x, point.y)
  context.stroke()
  lastPoint = point
}

async function onPadUp(event: PointerEvent) {
  if (!drawing) return
  drawing = false
  lastPoint = null
  pad.value?.releasePointerCapture(event.pointerId)
  await exportPad()
}

function clearPad() {
  setupPad()
  revoke(signatureUrl.value)
  signatureUrl.value = ''
  signatureBytes.value = null
  clearStamps()
  success.value = ''
}

async function showPage(index: number) {
  if (!pdfBytes.value) return
  loadingPage.value = true
  error.value = ''
  try {
    const preview = await renderPdfPage(pdfBytes.value, index)
    revoke(pageUrl.value)
    pageUrl.value = preview.url
    pageSize.value = { width: preview.width, height: preview.height }
    pages.value = preview.pages
    pageIndex.value = Math.min(index, preview.pages - 1)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
  } finally {
    loadingPage.value = false
  }
}

async function loadPdf(file: File | undefined) {
  error.value = ''
  success.value = ''
  if (!file) return
  if (!isPdfFile(file)) {
    error.value = 'Please choose a PDF file.'
    return
  }

  const buffer = new Uint8Array(await file.arrayBuffer())
  const result = await inspectPdfBytes(buffer, file.name)
  if (!result.ok) {
    error.value = result.message
    return
  }
  if (result.info.needsPassword) {
    error.value = 'This PDF is password-protected. Unlock it first, then sign.'
    return
  }

  pdfName.value = file.name
  pdfBytes.value = buffer
  clearStamps()
  await showPage(0)
}

async function loadSignatureFile(file: File | undefined) {
  if (!file) return
  error.value = ''
  success.value = ''
  if (!isImageFile(file)) {
    error.value = 'Signature images must be WEBP, JPG, PNG, or JPEG.'
    return
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  try {
    const size = await inspectImageBytes(bytes)
    setupPad()
    await setSignature(bytes, size.width, size.height)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : `Could not read ${file.name}.`
  }
}

function onPdfInput(event: Event) {
  const input = event.target as HTMLInputElement
  void loadPdf(input.files?.[0])
  input.value = ''
}

function onPdfDrop(event: DragEvent) {
  draggingPdf.value = false
  event.preventDefault()
  void loadPdf(event.dataTransfer?.files[0])
}

function onSignInput(event: Event) {
  const input = event.target as HTMLInputElement
  void loadSignatureFile(input.files?.[0])
  input.value = ''
}

function onSignDrop(event: DragEvent) {
  draggingSign.value = false
  event.preventDefault()
  void loadSignatureFile(event.dataTransfer?.files[0])
}

function stagePoint(event: PointerEvent) {
  const box = stage.value?.getBoundingClientRect()
  if (!box || box.width === 0 || box.height === 0) return null
  return {
    x: (event.clientX - box.left) / box.width,
    y: (event.clientY - box.top) / box.height,
  }
}

let dragOrigin = { x: 0, y: 0, width: 0, height: 0, pointerX: 0, pointerY: 0 }

function onOverlayMove(event: PointerEvent) {
  if (!dragMode.value) return
  const point = stagePoint(event)
  if (!point) return
  const dx = point.x - dragOrigin.pointerX
  const dy = point.y - dragOrigin.pointerY
  if (dragMode.value === 'move') {
    fitPlacement({
      x: dragOrigin.x + dx,
      y: dragOrigin.y + dy,
      width: dragOrigin.width,
      height: dragOrigin.height,
    })
    return
  }
  fitPlacement({
    x: dragOrigin.x,
    y: dragOrigin.y,
    width: dragOrigin.width + dx,
    height: dragOrigin.height,
  })
}

function onOverlayUp() {
  if (!dragMode.value) return
  dragMode.value = null
  window.removeEventListener('pointermove', onOverlayMove)
  window.removeEventListener('pointerup', onOverlayUp)
  window.removeEventListener('pointercancel', onOverlayUp)
}

function onOverlayDown(event: PointerEvent, mode: 'move' | 'resize') {
  event.preventDefault()
  event.stopPropagation()
  if (!currentStamp.value) return
  const point = stagePoint(event)
  if (!point) return
  dragMode.value = mode
  dragOrigin = {
    x: currentStamp.value?.x ?? 0,
    y: currentStamp.value?.y ?? 0,
    width: currentStamp.value?.width ?? 0.28,
    height: currentStamp.value?.height ?? 0.14,
    pointerX: point.x,
    pointerY: point.y,
  }
  window.addEventListener('pointermove', onOverlayMove)
  window.addEventListener('pointerup', onOverlayUp)
  window.addEventListener('pointercancel', onOverlayUp)
}

async function sign() {
  if (!canSign.value || !pdfBytes.value || !signatureBytes.value) return
  busy.value = true
  error.value = ''
  success.value = ''
  const result = await signPdfBytes(
    pdfBytes.value,
    signatureBytes.value,
    signedPageIndexes.value.map((index) => ({
      pageIndex: index,
      placement: stamps.value[index] ?? defaultPlacement(),
    })),
  )
  busy.value = false
  if (!result.ok) {
    error.value = result.message
    return
  }
  const filename = signedFileName(pdfName.value)
  downloadPdf(result.bytes, filename)
  success.value = `Signed ${formatPageList(signedPageIndexes.value)} · ${filename}`
}

onMounted(setupPad)
onBeforeUnmount(() => {
  onOverlayUp()
  revoke(pageUrl.value)
  revoke(signatureUrl.value)
})
</script>

<template>
  <main class="page">
    <section class="card stage">
      <p class="eyebrow">PDF</p>
      <h1>Sign</h1>
      <p class="lede">
        Place a signature on any pages you choose. Size and position are kept per page, and unsigned pages stay as they are.
      </p>

      <label
        class="dropzone"
        :class="{ dragging: draggingPdf, filled: !!pdfBytes }"
        @dragover.prevent="draggingPdf = true"
        @dragleave="draggingPdf = false"
        @drop="onPdfDrop"
      >
        <input type="file" accept="application/pdf,.pdf" @change="onPdfInput" />
        <strong v-if="pdfName">{{ pdfName }}</strong>
        <span v-else>Drop a PDF here, or click to choose one</span>
      </label>

      <div v-if="pageUrl" class="preview">
        <div
          ref="stage"
          class="page-stage"
          :style="{ aspectRatio: `${pageSize.width} / ${pageSize.height}` }"
        >
          <img :src="pageUrl" alt="PDF page preview" draggable="false" />
          <div
            v-if="signatureUrl && currentStamp"
            class="signature-overlay"
            :class="{ grabbing: dragMode === 'move' }"
            :style="{
              left: `${currentStamp.x * 100}%`,
              top: `${currentStamp.y * 100}%`,
              width: `${currentStamp.width * 100}%`,
              height: `${currentStamp.height * 100}%`,
            }"
            @pointerdown="onOverlayDown($event, 'move')"
          >
            <img :src="signatureUrl" alt="Signature" draggable="false" />
            <button
              class="resize-handle"
              type="button"
              aria-label="Resize signature"
              @pointerdown="onOverlayDown($event, 'resize')"
            />
          </div>
        </div>

        <div class="pager">
          <button type="button" :disabled="pageIndex === 0 || loadingPage" @click="showPage(pageIndex - 1)">
            Previous
          </button>
          <span>Page {{ pageIndex + 1 }} of {{ pages }}</span>
          <button
            type="button"
            :disabled="pageIndex >= pages - 1 || loadingPage"
            @click="showPage(pageIndex + 1)"
          >
            Next
          </button>
        </div>
        <div v-if="signatureBytes" class="pager stamp-actions">
          <button v-if="currentStamp" type="button" @click="removeFromCurrentPage">Remove from this page</button>
          <button v-else type="button" @click="placeOnCurrentPage">Place on this page</button>
        </div>
      </div>

      <div class="sign-tools">
        <div class="sign-pad-wrap">
          <span>Draw signature</span>
          <canvas
            ref="pad"
            class="sign-pad"
            @pointerdown="onPadDown"
            @pointermove="onPadMove"
            @pointerup="onPadUp"
            @pointercancel="onPadUp"
          />
          <button type="button" class="linkish" @click="clearPad">Clear drawing</button>
        </div>
        <label
          class="dropzone compact"
          :class="{ dragging: draggingSign, filled: !!signatureBytes }"
          @dragover.prevent="draggingSign = true"
          @dragleave="draggingSign = false"
          @drop="onSignDrop"
        >
          <input
            type="file"
            accept="image/webp,image/jpeg,image/png,.webp,.jpg,.jpeg,.png"
            @change="onSignInput"
          />
          <span>Or drop a signature image</span>
        </label>
      </div>

      <p class="status" :class="{ error: !!error, ok: !!success }">
        {{ error || success || statusText }}
      </p>

      <button class="btn" type="button" :disabled="!canSign" @click="sign">
        {{
          busy
            ? 'Signing…'
            : loadingPage
              ? 'Loading page…'
              : signedPageIndexes.length
                ? `Sign ${formatPageList(signedPageIndexes)} and download`
                : 'Sign and download'
        }}
      </button>
    </section>
  </main>
</template>
