import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// The Spring Boot backend runs on :8080 and owns everything under /api, plus the
// OAuth2 login endpoints. In dev we serve the React app from Vite (:5173) and proxy
// those paths to the backend so the browser stays same-origin (no CORS needed) and
// VITE_API_BASE_URL can stay unset.
//
// In production the two are deployed separately, so the proxy has no equivalent:
// the bundle is built with VITE_API_BASE_URL pointing at the backend's origin and
// the requests are genuinely cross-origin. See README.md.
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
