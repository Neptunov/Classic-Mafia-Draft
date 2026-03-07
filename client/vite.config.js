import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
	'/api': 'http://localhost:3000',
    sourcemap: true 
  }
})