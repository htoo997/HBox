<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'

const route = useRoute()
const isHome = computed(() => route.path === '/')
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <RouterLink class="brand" to="/">HBox</RouterLink>
      <span class="topbar-copy">{{ isHome ? 'Toolbox' : 'Tools' }}</span>
      <RouterLink v-if="!isHome" class="back" to="/">All tools</RouterLink>
    </header>
    <RouterView />
  </div>
</template>
