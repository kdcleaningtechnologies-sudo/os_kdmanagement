import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { SECURITY_HEADERS } from './src/lib/securityHeaders.ts'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  preview: {
    headers: SECURITY_HEADERS,
  },
})
