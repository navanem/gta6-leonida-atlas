import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: process.env.ATLAS_BASE_PATH || '/',
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      'virtual:atlas-account':
        process.env.ATLAS_PRIVATE_ENTRY ||
        fileURLToPath(new URL('./src/capabilities/GuestExtension.tsx', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@features': fileURLToPath(new URL('./src/features', import.meta.url)),
      '@lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
  server: { host: '127.0.0.1', port: 4330, strictPort: true },
  preview: { host: '127.0.0.1', port: 4330, strictPort: true },
  build: { chunkSizeWarningLimit: 650 },
});
