import { defineConfig } from 'vite'
import vueTermui from 'vue-termui/vite'

export default defineConfig({
  plugins: [
    vueTermui({ entry: '/src/tui/main.ts' }),
    {
      name: 'external-mupdf',
      apply: 'build',
      enforce: 'pre',
      resolveId(id) {
        if (id === 'mupdf' || id.startsWith('mupdf/')) {
          return { id, external: true }
        }
      },
    },
  ],
  optimizeDeps: {
    exclude: ['mupdf'],
  },
  ssr: {
    external: ['mupdf'],
    optimizeDeps: {
      exclude: ['mupdf'],
    },
  },
})
