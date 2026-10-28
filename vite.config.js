import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': '/src' },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/exceljs/')) return 'exceljs'
          if (id.includes('/node_modules/jspdf/')) return 'pdf'
          if (id.includes('/node_modules/html2canvas/')) return 'html2canvas'
          if (id.includes('/node_modules/dompurify/')) return 'purify'
          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/scheduler/')
          ) return 'vendor'
          return undefined
        },
      },
    },
  },
})
