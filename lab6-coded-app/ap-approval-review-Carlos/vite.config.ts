import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { uipathCodedApps } from '@uipath/coded-apps-dev/vite'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    uipathCodedApps(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    include: ['@uipath/uipath-typescript'],
  },
})
