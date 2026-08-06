# Amanly — storefront & admin UI

React 18 + TypeScript + Vite single-page app covering both the customer storefront and the admin
console. It is a pure static bundle; all data comes from the backend API.

> **The backend lives in a separate repository:**
> [`roy-aman/a-manly-shop-backend`](https://github.com/roy-aman/a-manly-shop-backend) (Spring Boot).
> The two deploy as independent Railway services.

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the internal structure.

## Requirements

- Node 20+

## Local development

```bash
npm install
npm run dev
```

Vite serves on `:5173` and proxies `/api`, `/oauth2` and `/login/oauth2` to a backend on
`localhost:8080` (see `vite.config.ts`), so the browser stays same-origin and no CORS setup is
needed locally. Run the backend separately from its own repository.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server with API proxy |
| `npm run build` | Typecheck (`tsc`) then production build into `dist/` |
| `npm run typecheck` | Types only, no emit |
| `npm test` | Vitest run |
| `npm run test:watch` | Vitest in watch mode |

## Configuration

One variable, and it is **build-time only**:

| Variable | Meaning |
| --- | --- |
| `VITE_API_BASE_URL` | Origin of the backend API, e.g. `https://api.example.com`. No trailing slash. |

Leave it **unset** for local development — the Vite proxy makes same-origin requests work, and an
empty base is exactly what `apiUrl()` in `src/lib/http.ts` falls back to.

Set it in any deployment where the backend is on a different origin. Two consequences follow:

1. Vite inlines `import.meta.env` into the bundle, so changing this value requires a **rebuild**,
   not a restart.
2. The backend must list this app's origin in its `CORS_ALLOWED_ORIGINS`, or every request fails
   preflight.

Only `src/lib/http.ts` knows about the API origin. Every module under `src/api/` passes
root-relative paths like `/api/v1/products` through `request()`, which resolves them — so adding a
new endpoint never involves the base URL.

## Deployment

`Dockerfile` builds the bundle and serves it with Caddy; `railway.json` points Railway at it.
Pass `VITE_API_BASE_URL` as a **build** variable, not a runtime one.

The `Caddyfile` does two things that matter:

- `try_files {path} /index.html` — React Router owns every path, so a deep link or a refresh on
  `/products/foo` must return the shell rather than a 404.
- Caches hashed assets immutably but sends `no-cache` for `index.html`. Reversing this leaves
  browsers booting a stale bundle against a newer API.
