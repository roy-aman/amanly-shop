import { defineConfig, loadEnv } from 'vite';
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
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = process.env.API_PROXY_TARGET?.trim() || env.API_PROXY_TARGET?.trim() || 'http://localhost:8088';
  const isDevCommand = process.argv.some((arg) => arg.includes('vite') || arg.includes('dev'));
  if (isDevCommand) {
    console.log(`\n\x1b[36m[api-proxy]\x1b[0m Target backend: \x1b[32m${apiTarget}\x1b[0m (mode: ${mode})\n`);
  }

  const proxyOptions = {
    target: apiTarget,
    changeOrigin: true,
    secure: false,
    headers: {
      // The backend resolves the store from the Origin header first, then Host.
      // Browsers omit the Origin header on same-origin GET requests. When proxying
      // with changeOrigin: true, the Host header is rewritten to the target host.
      // Supplying the Origin header ensures the backend maps the request to the store
      // attached to http://localhost:5173.
      Origin: 'http://localhost:5173',
    },
    configure: (proxy: any) => {
      proxy.on('error', (err: any, req: any) => {
        console.error(`\x1b[31m[proxy error]\x1b[0m ${req.method} ${req.url} -> ${apiTarget}: ${err.message}`);
      });
    },
  };

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': proxyOptions,
        '/oauth2': proxyOptions,
        '/login/oauth2': proxyOptions,
      },
    },
  };
});
