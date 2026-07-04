import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Consumer storefront — dev server on :5173 (allow-listed in backend CORS).
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
})
