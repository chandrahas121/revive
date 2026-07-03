import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Seller Central — standalone app on :5174 (allow-listed in backend CORS).
// The app serves everything under /seller (see src/main.jsx), so internal
// navigation to /seller/* keeps working unchanged.
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
})
