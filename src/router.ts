import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from './pages/Dashboard.vue'
import ImageToPdf from './pages/ImageToPdf.vue'
import PdfMerge from './pages/PdfMerge.vue'
import PdfSign from './pages/PdfSign.vue'
import PdfUnlocker from './pages/PdfUnlocker.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: Dashboard, meta: { title: 'HBox' } },
    { path: '/tools/pdf-unlock', name: 'pdf-unlock', component: PdfUnlocker, meta: { title: 'PDF Unlock · HBox' } },
    { path: '/tools/pdf-merge', name: 'pdf-merge', component: PdfMerge, meta: { title: 'PDF Merge · HBox' } },
    { path: '/tools/image-to-pdf', name: 'image-to-pdf', component: ImageToPdf, meta: { title: 'Image to PDF · HBox' } },
    { path: '/tools/pdf-sign', name: 'pdf-sign', component: PdfSign, meta: { title: 'PDF Sign · HBox' } },
  ],
})

router.afterEach((to) => {
  document.title = typeof to.meta.title === 'string' ? to.meta.title : 'HBox'
})
