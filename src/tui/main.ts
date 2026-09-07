import { createApp } from 'vue-termui'
import App from './App.vue'

const app = await createApp(App, null, {
  exitOnCtrlC: true,
  consoleMode: import.meta.env.PROD ? 'disabled' : 'console-overlay',
})

app.mount()
await app.waitUntilExit()
