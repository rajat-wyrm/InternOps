import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,

    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },

      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },

      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
      },
    },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');

          if (
            normalizedId.endsWith('/frontend/src/PrivilegedRoutes.jsx') ||
            normalizedId.endsWith('/src/PrivilegedRoutes.jsx')
          ) {
            return 'privileged-routes';
          }
        },
      },
    },
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
  },
});
