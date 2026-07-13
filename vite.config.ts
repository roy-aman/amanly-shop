import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// The Spring Boot backend runs on :8080 and owns everything under /api, plus the
// OAuth2 login endpoints. In dev we serve the React app from Vite (:5173) and proxy
// those paths to the backend so the browser stays same-origin (no CORS needed).
// For production, `npm run build:deploy` emits the bundle straight into
// src/main/resources/static so the JAR serves one app.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
      '/oauth2': { target: 'http://localhost:8080', changeOrigin: true },
      '/login/oauth2': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
});
