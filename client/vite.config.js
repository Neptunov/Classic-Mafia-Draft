import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // <-- This boolean forces Vite to expose to ALL network adapters
    port: 5173,
    strictPort: true, // Fails immediately if the port is blocked
  }
})