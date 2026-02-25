/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [
    react({
      // Exclude certain files from fast refresh that cause issues
      exclude: [/node_modules/],
      include: ['**/*.tsx', '**/*.ts'],
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3001,
    strictPort: true,
    host: true,
    hmr: {
      overlay: true,
    },
    proxy: {
      '/api/geocode': {
        target: 'https://geocoding-api.open-meteo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/geocode/, ''),
      },
      '/api/timezone': {
        target: 'https://api.open-meteo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/timezone/, ''),
      },
      // KYI previously proxied to a separate Flask app; Supabase-backed KYI no longer requires this proxy.
    },
    watch: {
      // Ignore certain patterns that might cause excessive reloads
      ignored: ['**/node_modules/**', '**/.git/**'],
    },
  },
  build: {
    chunkSizeWarningLimit: 1000, // Increase limit to 1000kb for lucide-react
    rollupOptions: {
      output: {
        manualChunks: {
          'lucide-react': ['lucide-react'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}', 'src/main.tsx', 'src/vite-env.d.ts'],
    },
  },
})
