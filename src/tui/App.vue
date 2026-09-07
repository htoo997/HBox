<script setup lang="ts">
import { basename } from 'node:path'
import {
  Box,
  Input,
  ProgressBar,
  Select,
  Text,
  bold,
  computed,
  fg,
  onKeyDown,
  onMounted,
  ref,
  shallowRef,
  t,
  useCurrentFocusedElement,
  useExit,
  useTitle,
  watch,
} from 'vue-termui'
import type { SelectOption } from 'vue-termui'
import { defaultOutputPath, displayPath, expandPath, initialPdfArg, uniqueOutputPath } from '../pdf/paths'
import { inspectPdf, listNearbyPdfs, unlockPdf } from '../pdf/unlocker'
import type { PdfStatus } from '../pdf/unlocker'

useTitle('PDF Unlocker')

const exit = useExit()
const currentFocused = useCurrentFocusedElement()

type HostEl = { focus?: () => void; $el?: { focus?: () => void } }
const nearbySelect = shallowRef<HostEl | null>(null)
const sourceInput = shallowRef<HostEl | null>(null)
const passwordInput = shallowRef<HostEl | null>(null)
const outputInput = shallowRef<HostEl | null>(null)

function host(instance: HostEl | null | undefined) {
  if (!instance) return null
  return instance.$el ?? instance
}

function fieldHosts() {
  return [nearbySelect.value, sourceInput.value, passwordInput.value, outputInput.value]
    .map(host)
    .filter((el): el is NonNullable<ReturnType<typeof host>> => !!el?.focus)
}

function cycleFocus(step: 1 | -1) {
  const fields = fieldHosts()
  if (!fields.length) return
  const index = fields.findIndex((el) => el === currentFocused.value)
  const next = index < 0 ? fields[step > 0 ? 0 : fields.length - 1] : fields[(index + step + fields.length) % fields.length]
  next?.focus?.()
}

function formFieldFocused() {
  const focused = currentFocused.value
  return !!focused && fieldHosts().includes(focused)
}

const sourcePath = ref(initialPdfArg())
const outputPath = ref(sourcePath.value ? defaultOutputPath(sourcePath.value) : '')
const password = ref('')
const outputTouched = ref(false)

const nearby = ref<string[]>([])
const nearbyIndex = ref(0)
const status = ref<PdfStatus>({ kind: 'empty' })
const busy = ref(false)
const progress = ref(0)
const flash = ref<{ tone: 'ok' | 'err' | 'info'; text: string } | null>(null)

let inspectSeq = 0
let progressTimer: ReturnType<typeof setInterval> | undefined

const nearbyOptions = computed<SelectOption[]>(() =>
  nearby.value.map((filePath) => ({
    name: basename(filePath),
    description: displayPath(filePath),
    value: filePath,
  })),
)

const canUnlock = computed(() => {
  if (busy.value) return false
  if (status.value.kind !== 'ready') return false
  if (status.value.needsPassword && !password.value) return false
  return outputPath.value.trim().length > 0
})

const statusLine = computed(() => {
  const current = status.value
  switch (current.kind) {
    case 'empty':
      return t`${fg('#6c7086')('Paste a PDF path, or pick one from the list.')}`
    case 'missing':
      return t`${fg('#f38ba8')('File not found')}  ${fg('#6c7086')(displayPath(current.path))}`
    case 'not-file':
      return t`${fg('#f38ba8')('Not a file')}  ${fg('#6c7086')(displayPath(current.path))}`
    case 'not-pdf':
      return t`${fg('#f38ba8')('Not a PDF')}  ${fg('#6c7086')(displayPath(current.path))}`
    case 'error':
      return t`${fg('#f38ba8')(current.message)}`
    case 'ready': {
      const pages = current.pages > 0 ? `${current.pages} page${current.pages === 1 ? '' : 's'}` : 'pages locked'
      const enc = current.encryption && current.encryption !== 'None' ? current.encryption : ''
      if (current.needsPassword) {
        return t`${fg('#f9e2af')('Password required')}  ${fg('#cdd6f4')(pages)}  ${fg('#6c7086')(enc)}`
      }
      if (enc) {
        return t`${fg('#89b4fa')('Opens without a password')}  ${fg('#cdd6f4')(pages)}  ${fg('#6c7086')(`${enc} · restrictions can be removed`)}`
      }
      return t`${fg('#a6e3a1')('Already unlocked')}  ${fg('#cdd6f4')(pages)}`
    }
  }
})

const hint = computed(() => {
  if (busy.value) return t`${fg('#6c7086')('Unlocking…')}`
  return t`${bold('Tab')} fields  ${bold('Enter')} unlock  ${bold('Ctrl+U')} unlock  ${bold('q')} quit`
})

const flashColor = computed(() => {
  if (!flash.value) return '#6c7086'
  return flash.value.tone === 'ok' ? '#a6e3a1' : flash.value.tone === 'err' ? '#f38ba8' : '#89b4fa'
})

async function refreshNearby() {
  nearby.value = await listNearbyPdfs()
}

async function runInspect(path = sourcePath.value) {
  const seq = ++inspectSeq
  const next = await inspectPdf(path)
  if (seq !== inspectSeq) return
  status.value = next
  if (next.kind === 'ready') fillDefaultOutput(next.path)
}

function pickNearby(_option: SelectOption | null, index: number) {
  const filePath = nearby.value[index]
  if (!filePath) return
  outputTouched.value = false
  sourcePath.value = filePath
}

function stopProgress() {
  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = undefined
  }
}

function startProgress() {
  stopProgress()
  progress.value = 8
  progressTimer = setInterval(() => {
    if (progress.value < 88) progress.value += 7
  }, 90)
}

async function unlock() {
  if (busy.value) return
  flash.value = null

  if (status.value.kind !== 'ready') {
    await runInspect()
  }
  if (status.value.kind !== 'ready') {
    flash.value = { tone: 'err', text: 'Choose a valid PDF first.' }
    return
  }
  if (status.value.needsPassword && !password.value) {
    flash.value = { tone: 'err', text: 'Enter the PDF password.' }
    return
  }

  const destination = uniqueOutputPath(expandPath(outputPath.value || defaultOutputPath(status.value.path)))
  busy.value = true
  startProgress()

  const result = await unlockPdf(status.value.path, destination, password.value)
  stopProgress()
  progress.value = result.ok ? 100 : 0
  busy.value = false

  if (!result.ok) {
    flash.value = { tone: 'err', text: result.message }
    return
  }

  outputPath.value = result.outputPath
  password.value = ''
  flash.value = {
    tone: 'ok',
    text: result.alreadyUnlocked
      ? `Saved copy without restrictions · ${displayPath(result.outputPath)}`
      : `Unlocked ${result.pages} page${result.pages === 1 ? '' : 's'} · ${displayPath(result.outputPath)}`,
  }
  await runInspect()
}

onMounted(async () => {
  await refreshNearby()
  if (sourcePath.value) await runInspect(sourcePath.value)
})

let inspectTimer: ReturnType<typeof setTimeout> | undefined
let syncingOutput = false

function fillDefaultOutput(path: string) {
  if (outputTouched.value) return
  syncingOutput = true
  outputPath.value = defaultOutputPath(path)
  queueMicrotask(() => {
    syncingOutput = false
  })
}

function onOutputInput() {
  if (!syncingOutput) outputTouched.value = true
}

watch(sourcePath, (value) => {
  flash.value = null
  fillDefaultOutput(value)
  if (inspectTimer) clearTimeout(inspectTimer)
  inspectTimer = setTimeout(() => {
    void runInspect(value)
  }, 220)
})

onKeyDown((key) => {
  if (key.name === 'tab') {
    key.preventDefault()
    key.stopPropagation()
    cycleFocus(key.shift ? -1 : 1)
    return
  }

  if (key.ctrl && key.name === 'u') {
    key.preventDefault()
    void unlock()
    return
  }

  if (key.name === 'q' && !formFieldFocused()) {
    exit()
  }
})
</script>

<template>
  <Box
    flexDirection="column"
    width="100%"
    height="100%"
    backgroundColor="#181825"
    :padding="1"
    :gap="1"
  >
    <Box
      flexDirection="column"
      border
      borderStyle="rounded"
      borderColor="#42b883"
      backgroundColor="#1e1e2e"
      :padding="1"
      :gap="0"
    >
      <Text bold fg="#42b883">PDF Unlocker</Text>
      <Text fg="#a6adc8">Remove a known password from PDFs you own. Vue 3 + Vue TermUI.</Text>
    </Box>

    <Box flexDirection="row" :gap="1" :flexGrow="1">
      <Box
        v-if="nearbyOptions.length"
        flexDirection="column"
        border
        borderStyle="rounded"
        borderColor="#45475a"
        backgroundColor="#1e1e2e"
        title=" Nearby PDFs "
        :padding="1"
        :width="36"
        :flexShrink="0"
      >
        <Select
          :ref="(el) => { nearbySelect.value = el as HostEl | null }"
          v-model="nearbyIndex"
          :options="nearbyOptions"
          showDescription
          :focus="!sourcePath"
          @select="pickNearby"
        />
      </Box>

      <Box flexDirection="column" :flexGrow="1" :gap="1">
        <Box
          flexDirection="column"
          border
          borderStyle="rounded"
          borderColor="#45475a"
          backgroundColor="#1e1e2e"
          title=" Source PDF "
          :padding="1"
          :gap="1"
        >
          <Input
            :ref="(el) => { sourceInput.value = el as HostEl | null }"
            v-model="sourcePath"
            placeholder="Path to a .pdf file…"
            width="100%"
            :focus="!!sourcePath || nearbyOptions.length === 0"
            textColor="#cdd6f4"
            backgroundColor="#11111b"
            focusedBackgroundColor="#313244"
            placeholderColor="#6c7086"
            :maxLength="500"
            @enter="runInspect()"
          />
          <Text :content="statusLine" />
        </Box>

        <Box
          flexDirection="column"
          border
          borderStyle="rounded"
          borderColor="#45475a"
          backgroundColor="#1e1e2e"
          title=" Password "
          :padding="1"
        >
          <Input
            :ref="(el) => { passwordInput.value = el as HostEl | null }"
            v-model="password"
            placeholder="Leave empty if the file already opens"
            width="100%"
            textColor="#cdd6f4"
            backgroundColor="#11111b"
            focusedBackgroundColor="#313244"
            placeholderColor="#6c7086"
            :maxLength="200"
            @enter="unlock()"
          />
        </Box>

        <Box
          flexDirection="column"
          border
          borderStyle="rounded"
          borderColor="#45475a"
          backgroundColor="#1e1e2e"
          title=" Save unlocked copy as "
          :padding="1"
        >
          <Input
            :ref="(el) => { outputInput.value = el as HostEl | null }"
            v-model="outputPath"
            placeholder="Output path…"
            width="100%"
            textColor="#cdd6f4"
            backgroundColor="#11111b"
            focusedBackgroundColor="#313244"
            placeholderColor="#6c7086"
            :maxLength="500"
            @input="onOutputInput"
            @enter="unlock()"
          />
        </Box>
      </Box>
    </Box>

    <Box
      flexDirection="column"
      border
      borderStyle="rounded"
      :borderColor="canUnlock ? '#42b883' : '#45475a'"
      backgroundColor="#1e1e2e"
      :padding="1"
      :gap="1"
    >
      <Box flexDirection="row" :gap="1" alignItems="center">
        <Text :fg="canUnlock ? '#42b883' : '#6c7086'" bold>{{ canUnlock ? 'Ready' : 'Waiting' }}</Text>
        <ProgressBar :value="progress" :max="100" :width="28" color="#42b883" trackColor="#313244" />
        <Text fg="#6c7086">{{ progress }}%</Text>
      </Box>
      <Text v-if="flash" :fg="flashColor">{{ flash.text }}</Text>
      <Text v-else :content="hint" />
    </Box>
  </Box>
</template>
