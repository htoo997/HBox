<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { tools } from '../tools'
</script>

<template>
  <main class="dashboard">
    <section class="hero">
      <h1>Choose a tool</h1>
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
