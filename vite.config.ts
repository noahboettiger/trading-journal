import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
      '@shared': path.resolve(process.cwd(), 'shared'),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4317',
      '/uploads': 'http://localhost:4317',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
