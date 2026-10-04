import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { jsonDbPlugin } from './server/json-db.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), jsonDbPlugin()],
  // Local-only app: one bundle is fine.
  build: { chunkSizeWarningLimit: 1500 },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
