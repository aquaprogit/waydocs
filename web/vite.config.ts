import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5183,
    proxy: {
      '/api': 'http://localhost:5180',
    },
  },
  preview: {
    port: 4183,
    proxy: {
      '/api': 'http://localhost:5180',
    },
  },
})
