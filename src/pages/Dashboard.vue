<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchLocalAqi, type AqiReading } from '../air/aqi'
import { tools } from '../tools'

const aqi = ref<AqiReading | null>(null)
const aqiError = ref(false)
const controller = new AbortController()

onMounted(() => {
  void fetchLocalAqi(controller.signal)
    .then((reading) => {
      aqi.value = reading
    })
    .catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return
      aqiError.value = true
    })
})

onUnmounted(() => controller.abort())
</script>

<template>
  <main class="dashboard">
    <section class="hero">
      <div class="hero-heading">
        <h1>Choose a tool</h1>
        <p class="aqi" :title="aqi ? `${aqi.placeTitle} US AQI ${aqi.value} · ${aqi.label}` : 'Local air quality'">
          <span class="aqi-place">{{ aqi ? `${aqi.place} AQI` : 'AQI' }}</span>
          <span v-if="aqi" class="aqi-value" :style="{ color: aqi.color }">
            <strong>{{ aqi.value }}</strong>
            <span>{{ aqi.label }}</span>
          </span>
          <span v-else-if="aqiError" class="aqi-fallback">unavailable</span>
        </p>
      </div>
      <p>Local file utilities. Files stay in your browser.</p>
    </section>

    <section class="grid">
      <RouterLink v-for="tool in tools" :key="tool.id" class="tool-tile" :to="tool.to">
        <span class="swatch" :style="{ background: tool.accent }" />
        <h2>{{ tool.name }}</h2>
        <p>{{ tool.description }}</p>
        <span class="open">Open</span>
      </RouterLink>
    </section>
  </main>
</template>
