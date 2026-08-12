import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// The Spring Boot backend owns everything under /api plus the OAuth2 login
// endpoints. In dev we serve the React app from Vite (:5173) and proxy those
// paths to it, so the browser stays same-origin, no CORS setup is needed, and
// VITE_API_BASE_URL can stay unset.
//
// Production does the same thing with Caddy rather than losing the proxy: the
// backend picks which shop a request belongs to from the Host header, so the
// browser must talk to the shop's own domain. See the Caddyfile and README.md.
//
// `changeOrigin: false` is deliberate — it forwards the browser's Host
// (localhost:5173) rather than rewriting it to the target, which is closest to
// how production behaves. Locally no shop owns that hostname, so the backend
// falls back to the store whose slug is `default` (or honours X-Store-Slug when
// the operator has enabled header resolution).
const API_TARGET = process.env.API_PROXY_TARGET ?? 'http://localhost:8080';

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
      '/api': { target: API_TARGET, changeOrigin: false },
      '/oauth2': { target: API_TARGET, changeOrigin: false },
      '/login/oauth2': { target: API_TARGET, changeOrigin: false },
    },
  },
});
