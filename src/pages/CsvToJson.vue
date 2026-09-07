<script setup lang="ts">
import { computed, ref } from 'vue'
import { downloadText } from '../csv/download'
import { isCsvFile, jsonFileName, parseCsv, toJson, type CsvRow } from '../csv/parse'

const PREVIEW_ROWS = 20

const fileName = ref('')
const headers = ref<string[]>([])
const rows = ref<CsvRow[]>([])
const pretty = ref(true)
const dragging = ref(false)
const error = ref('')
const success = ref('')

const previewRows = computed(() => rows.value.slice(0, PREVIEW_ROWS))
const previewJson = computed(() => toJson(previewRows.value, pretty.value))
const canDownload = computed(() => rows.value.length > 0)

const statusText = computed(() => {
  if (!fileName.value) return 'Drop a CSV or TSV file. Conversion stays on this device.'
  if (!rows.value.length) return 'No data rows to convert.'
  const extra =
    rows.value.length > PREVIEW_ROWS
      ? ` · previewing the first ${PREVIEW_ROWS}`
      : ''
  return `${rows.value.length} row${rows.value.length === 1 ? '' : 's'} · ${headers.value.length} column${headers.value.length === 1 ? '' : 's'}${extra}`
})

async function loadFile(file: File | undefined) {
  error.value = ''
  success.value = ''
  fileName.value = ''
  headers.value = []
  rows.value = []

  if (!file) return
  if (!isCsvFile(file)) {
    error.value = 'Please choose a CSV or TSV file.'
    return
  }

  const text = await file.text()
  const result = parseCsv(text)
  if (!result.ok) {
    error.value = result.message
    return
  }

  fileName.value = file.name
  headers.value = result.headers
  rows.value = result.rows
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

function download() {
  if (!canDownload.value) return
  const filename = jsonFileName(fileName.value)
  downloadText(toJson(rows.value, pretty.value), filename, 'application/json')
  success.value = `Saved ${filename} with ${rows.value.length} row${rows.value.length === 1 ? '' : 's'}`
}
</script>

<template>
  <main class="page">
    <section class="card stage">
      <p class="eyebrow">CSV</p>
      <h1>To JSON</h1>
      <p class="lede">
        Convert a CSV or TSV file into JSON. Preview the table and JSON, then download when it looks right.
      </p>

      <label
        class="dropzone"
        :class="{ dragging, filled: !!fileName }"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop="onDrop"
      >
        <input type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" @change="onFileInput" />
        <strong v-if="fileName">{{ fileName }}</strong>
        <span v-else>Drop a CSV here, or click to choose one</span>
      </label>

      <div v-if="rows.length" class="preview-block">
        <div class="preview-heading">
          <span>Table preview</span>
          <small v-if="rows.length > PREVIEW_ROWS">First {{ PREVIEW_ROWS }} of {{ rows.length }} rows</small>
        </div>
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th v-for="header in headers" :key="header">{{ header }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in previewRows" :key="index">
                <td v-for="header in headers" :key="header">{{ row[header] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="rows.length" class="preview-block">
        <div class="preview-heading">
          <span>JSON preview</span>
          <label class="toggle">
            <input v-model="pretty" type="checkbox" />
            Pretty print
          </label>
        </div>
        <pre class="json-preview">{{ previewJson }}</pre>
      </div>

      <p class="status" :class="{ error: !!error, ok: !!success }">
        {{ error || success || statusText }}
      </p>

      <button class="btn" type="button" :disabled="!canDownload" @click="download">
        Download JSON
      </button>
    </section>
  </main>
</template>
