<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  convert,
  currencies,
  fetchUsdRates,
  formatAmount,
  formatRateDate,
  type RateTable,
} from '../fx/rates'

const amount = ref('1')
const from = ref('USD')
const to = ref('THB')
const table = ref<RateTable | null>(null)
const error = ref('')
const controller = new AbortController()

const parsedAmount = computed(() => {
  const value = Number(amount.value.replace(/,/g, ''))
  return Number.isFinite(value) ? value : null
})

const converted = computed(() => {
  if (parsedAmount.value === null || !table.value) return null
  return convert(parsedAmount.value, from.value, to.value, table.value.rates)
})

const unitRate = computed(() => {
  if (!table.value) return null
  return convert(1, from.value, to.value, table.value.rates)
})

const statusText = computed(() => {
  if (error.value) return error.value
  if (!table.value || unitRate.value === null) return 'Loading mid-market rates…'
  const updated = formatRateDate(table.value.updatedAt)
  const rate = `1 ${from.value} = ${formatAmount(unitRate.value, to.value)} ${to.value}`
  return updated ? `${rate} · updated ${updated}` : rate
})

function swap() {
  const nextAmount = converted.value
  const nextFrom = to.value
  to.value = from.value
  from.value = nextFrom
  if (nextAmount !== null) {
    amount.value = formatAmount(nextAmount, nextFrom).replace(/,/g, '')
  }
}

onMounted(() => {
  void fetchUsdRates(controller.signal)
    .then((rates) => {
      table.value = rates
    })
    .catch((cause: unknown) => {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      error.value = 'Could not load exchange rates.'
    })
})

onUnmounted(() => controller.abort())
</script>

<template>
  <main class="page">
    <section class="card">
      <p class="eyebrow">FX</p>
      <h1>Exchange Rate</h1>
      <p class="lede">Convert between currencies with the latest mid-market rate.</p>

      <label class="field">
        <span>Amount</span>
        <div class="fx-row">
          <input v-model="amount" type="text" inputmode="decimal" autocomplete="off" />
          <select v-model="from">
            <option v-for="currency in currencies" :key="currency.code" :value="currency.code">
              {{ currency.code }} · {{ currency.name }}
            </option>
          </select>
        </div>
      </label>

      <button class="fx-swap" type="button" aria-label="Swap" title="Swap" @click="swap">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M7 4v16m0 0-3.5-3.5M7 20l3.5-3.5M17 20V4m0 0-3.5 3.5M17 4l3.5 3.5"
          />
        </svg>
      </button>

      <div class="field">
        <span>Converted</span>
        <div class="fx-row">
          <p class="fx-result">{{ converted === null ? '—' : formatAmount(converted, to) }}</p>
          <select v-model="to">
            <option v-for="currency in currencies" :key="currency.code" :value="currency.code">
              {{ currency.code }} · {{ currency.name }}
            </option>
          </select>
        </div>
      </div>

      <p class="status" :class="{ error: !!error }">{{ statusText }}</p>
    </section>
  </main>
</template>
