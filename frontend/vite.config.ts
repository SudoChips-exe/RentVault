import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // `npm run dev` only serves the frontend - in production Express serves
    // both /api and this build from the same origin, but locally there's no
    // server in front of Vite to own /api, so callApi() (lib/api.ts) would
    // 404 without this proxying straight to backend/server.
    proxy: {
      '/api': {
        target: process.env.BACKEND_URL || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
