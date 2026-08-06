/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Origin of the backend API, e.g. `https://api.example.com`. Baked in at build time.
   *
   * Leave it unset for same-origin deployments (the Spring JAR serving its own bundle) and
   * for local dev, where Vite proxies /api to :8080. Set it when the frontend is hosted
   * separately from the backend — then `CORS_ALLOWED_ORIGINS` must name this frontend's
   * origin on the backend, or every request fails preflight.
   */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
}
