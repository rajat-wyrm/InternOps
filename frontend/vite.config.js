import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxies API + uploaded files to the Fastify backend on :5000
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:5000', changeOrigin: true },
    },
  },
});
