<script setup lang="ts">
import { computed, ref } from 'vue'
import { inspectPdfBytes, unlockedFileName, unlockPdfBytes, type PdfInfo } from '../pdf/core'
import { downloadPdf, isPdfFile } from '../pdf/download'

const file = ref<File | null>(null)
const bytes = ref<Uint8Array | null>(null)
const info = ref<PdfInfo | null>(null)
const password = ref('')
const busy = ref(false)
const dragging = ref(false)
const error = ref('')
const success = ref('')

const canUnlock = computed(() => {
  if (busy.value || !bytes.value || !info.value) return false
  if (info.value.needsPassword && !password.value) return false
  return true
})

const statusText = computed(() => {
  if (!info.value) return 'Drop a PDF or choose a file. Unlocking stays on this device.'
  const pages = info.value.pages > 0 ? `${info.value.pages} page${info.value.pages === 1 ? '' : 's'}` : 'pages locked'
  if (info.value.needsPassword) return `Password required · ${pages}`
  if (info.value.encryption && info.value.encryption !== 'None') {
    return `Opens without a password · ${pages} · restrictions can be removed`
  }
  return `Already unlocked · ${pages}`
})

async function loadFile(next: File | undefined) {
  error.value = ''
  success.value = ''
  info.value = null
  bytes.value = null
  file.value = null
  password.value = ''

  if (!next) return
  if (!isPdfFile(next)) {
    error.value = 'Please choose a PDF file.'
    return
  }

  const buffer = new Uint8Array(await next.arrayBuffer())
  const result = await inspectPdfBytes(buffer, next.name)
  if (!result.ok) {
    error.value = result.message
    return
  }

  file.value = next
  bytes.value = buffer
  info.value = result.info
}

function onFileInput(event: Event) {
  const input = event.target as HTMLInputElement
  void loadFile(input.files?.[0])
  input.value = ''
}

function onDrop(event: DragEvent) {
  dragging.value = false
  event.preventDefault()
  void loadFile(event.dataTransfer?.files[0])
}

async function unlock() {
  if (!bytes.value || !file.value || !canUnlock.value) return
  busy.value = true
  error.value = ''
  success.value = ''

  const result = await unlockPdfBytes(bytes.value, password.value)
  busy.value = false

  if (!result.ok) {
    error.value = result.message
    return
  }

  downloadPdf(result.bytes, unlockedFileName(file.value.name))
  success.value = result.alreadyUnlocked
    ? `Saved a copy without restrictions as ${unlockedFileName(file.value.name)}`
    : `Unlocked ${result.pages} page${result.pages === 1 ? '' : 's'} · ${unlockedFileName(file.value.name)}`
  password.value = ''
}
</script>

<template>
  <main class="page">
    <section class="card">
      <p class="eyebrow">PDF</p>
      <h1>Unlock</h1>
      <p class="lede">
        Remove a known password from PDFs you own. The file is processed in your browser and is not uploaded.
      </p>

      <label
        class="dropzone"
        :class="{ dragging, filled: !!file }"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop="onDrop"
      >
        <input type="file" accept="application/pdf,.pdf" @change="onFileInput" />
        <strong v-if="file">{{ file.name }}</strong>
        <span v-else>Drop a PDF here, or click to choose one</span>
      </label>

      <p class="status" :class="{ error: !!error, ok: !!success }">
        {{ error || success || statusText }}
      </p>

      <label class="field">
        <span>Password</span>
        <input
          v-model="password"
          type="password"
          autocomplete="off"
          placeholder="Leave empty if the file already opens"
          :disabled="!info"
          @keydown.enter="unlock"
        />
      </label>

      <button class="btn" type="button" :disabled="!canUnlock" @click="unlock">
        {{ busy ? 'Unlocking…' : 'Unlock and download' }}
      </button>
    </section>
  </main>
</template>
