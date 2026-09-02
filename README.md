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
`localhost:8088` (see `vite.config.ts`), so the browser stays same-origin and no CORS setup is
needed locally. Run the backend separately from its own repository.

To run the frontend against local backend:

```bash
npm run dev
```

To run the same frontend against the production backend through the local Vite proxy:

```bash
npm run prod
```

If your backend listens elsewhere, point the proxy at it with a command override:

```powershell
$env:API_PROXY_TARGET='http://localhost:8088'; npm run dev
```

```bash
API_PROXY_TARGET=http://localhost:8088 npm run dev
```

`localhost` belongs to no shop, so the backend resolves the store whose slug is `default`. To work
against a different shop locally, the operator enables `APP_TENANT_ALLOW_HEADER_RESOLUTION` and you
send `X-Store-Slug`; that header is ignored in production and must never be a product feature.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server with `/api` proxied to local backend (`.env.development`) |
| `npm run prod` | Dev server with `/api` proxied to production backend (`.env.production`) |
| `npm run dev:local` | Alias for `npm run dev` |
| `npm run dev:prod` | Alias for `npm run prod` |
| `npm run build` | Typecheck (`tsc`) then production build into `dist/` |
| `npm run build:prod` | Alias for `npm run build` |
| `npm run typecheck` | Types only, no emit |
| `npm test` | Vitest run |
| `npm run test:watch` | Vitest in watch mode |

## Configuration

| Variable | When | Meaning |
| --- | --- | --- |
| `API_PROXY_TARGET` | local Vite dev server | Backend origin Vite proxies `/api`, `/oauth2`, and `/login/oauth2` to. Loaded from `.env.development` or `.env.production` based on the npm script. |
| `API_UPSTREAM` | runtime (Caddy) | Address Caddy proxies `/api/*` to, e.g. `http://backend.railway.internal:8080`. |
| `VITE_API_BASE_URL` | build (Vite) | Escape hatch only. Leave unset. See the warning below. |

Leave `VITE_API_BASE_URL` **unset** for normal local development and production deployment. The
Vite/Caddy proxy forwards `/api` to the selected backend, and an empty API base is what `apiUrl()`
in `src/lib/http.ts` falls back to.

Only `src/lib/http.ts` knows about the API origin. Every module under `src/api/` passes
root-relative paths like `/api/v1/products` through `request()`, which resolves them — so adding a
new endpoint never involves the base URL.

> **Do not point `VITE_API_BASE_URL` at the backend's own hostname.** One backend serves many
> shops and picks which one from the `Host` header. A browser calling `https://api.example.com`
> directly sends a Host that belongs to no shop, so **every request resolves to the fallback
> store** — silently, and in the worst possible direction. Serve the SPA and proxy `/api` from the
> shop's own domain instead (below). The variable exists for clients that genuinely cannot proxy,
> and those must reach the shop by a hostname that belongs to it and be added to the backend's
> `CORS_ALLOWED_ORIGINS`.

## Deployment

`Dockerfile` builds the bundle and serves it with Caddy; `railway.json` points Railway at it. Set
`API_UPSTREAM` as a **runtime** variable.

The `Caddyfile` does three things that matter:

- `reverse_proxy /api/* /oauth2/*` — keeps the browser same-origin with the shop's domain, which is
  what lets the backend resolve the right shop (and removes CORS entirely).
- `try_files {path} /index.html` — React Router owns every path, so a deep link or a refresh on
  `/products/foo` must return the shell rather than a 404.
- Caches hashed assets immutably but sends `no-cache` for `index.html`. Reversing this leaves
  browsers booting a stale bundle against a newer API.

Behind the proxy the backend also needs `server.forward-headers-strategy` set (the `prod` profile
already does it), or per-IP rate limiting sees only the proxy's address.

## What this app is

Amanly's own storefront and admin console — one shop on a multi-tenant backend. It additionally
carries the **platform console** at `/platform`, visible only to an account holding
`PLATFORM_ADMIN`, for managing the other shops on the platform: creating them, setting what each is
entitled to use, and attaching the hostnames they answer on. See
[`docs/platform-console-guide.md`](docs/platform-console-guide.md).
