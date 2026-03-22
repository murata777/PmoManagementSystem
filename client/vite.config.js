import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
const apiProxy = {
  '/api': {
    target: 'http://localhost:5000',
    changeOrigin: true,
  },
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: apiProxy,
  },
  // `vite preview` でも API をバックエンドへ転送（未設定だと /api が 404 になる）
  preview: {
    host: '0.0.0.0',
    port: 3000,
    proxy: apiProxy,
  },
})
