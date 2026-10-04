import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { copyFileSync } from 'node:fs'

const copyApacheConfig = () => ({
  name: 'copy-apache-config',
  closeBundle() {
    copyFileSync(resolve(import.meta.dirname, 'production.htaccess'), resolve(import.meta.dirname, 'dist', '.htaccess'))
  },
})

export default defineConfig({
  plugins: [react(), copyApacheConfig()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        register: resolve(import.meta.dirname, 'register.html'),
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 8080,
    strictPort: true,
    allowedHosts: ['jacket-blank-maturely.ngrok-free.dev'],
    fs: {
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/private/**', '**/api/**', '**/database/**', '**/*.sql', '**/*.log'],
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 8080,
  },
})
