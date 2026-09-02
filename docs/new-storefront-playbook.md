# New Storefront Playbook — instructions for AI agents building a store UI

**You are an AI coding agent asked to build a new storefront UI** on the Royal Commerce platform: one Spring Boot backend serving many stores, each store with its own frontend repo and deployment. The reference implementation — architecture, conventions, integrations, and hard-won fixes — is the **`amanly-store`** repo (GitHub `roy-aman/amanly-shop`), the first storefront built on this backend. The backend repo is `roy-aman/royal-commerce-service`.

**This document is your operating contract.** Read all of it before writing any code. It tells you how to run discovery, how to scope the store, what to reuse, what the backend guarantees, and — most importantly — the register of mistakes already made and fixed once (§7). Reintroducing a §7 mistake is the single worst outcome of your work.

**The running backend is the source of truth, and it is reachable.** Production API:
`https://royal-commerce-service-production.up.railway.app` — OpenAPI at `/api-docs`, browser UI at
`/swagger-ui`. When this playbook, a doc, or your recollection disagrees with it, **it wins** (L21).
Probe it before you design against a shape: `curl -H "Origin: <an attached origin>" <API>/api/v1/store`.
Note that `Origin` is required — a bare request is `404 STORE_NOT_MAPPED`, because there is no
fallback store (L2). Verified 2026-09-03: `http://localhost:5173` is attached to `amanly-store`;
`http://localhost:8081` is attached to nothing.

**`amanly-store` is the reference for every backend-facing implementation.** Before writing anything
that touches the API — the HTTP client, an `api/` module, a DTO in `types.ts`, auth and token
handling, tenancy claims, money and totals, checkout and payment — **read how `amanly-store` does it
first and follow that**. It is the only storefront that has been run against this backend in anger,
so its shapes are verified and yours are guesses. Deviate only where the Store Brief calls for a
genuinely different behaviour, and say so in the code. This applies to *implementation*, not to
appearance: the visual identity, page composition and copy are yours to design fresh (§4.3).

**Prerequisites** — ask the user for whichever you don't have:
1. Read access to the `amanly-store` repo (the source of truth for frontend patterns; its `ARCHITECTURE.md` is the module-level contract).
2. The backend contract docs, if available: `docs/storefront-api-guide.md` (full HTTP contract), `docs/store-identification-ui-guide.md` (tenant resolution — authoritative), `docs/booking-ui-build-plan.md` (booking/service UI, if the store takes bookings). This playbook carries the critical facts inline, but those docs carry every field.

**Your workflow is fixed:** Discovery → Store Brief approval → Scaffold → Build in milestones → Validate → Deployment handoff. **Never start coding before the Store Brief is approved.**

---

## 1. System context

- **One backend, many stores.** Every store's catalog, orders, customers, settings and entitlements are tenant-scoped rows in one database. The backend resolves *which* store a request belongs to from the browser `Origin` first, then `Host`. There is **no fallback store**: an address no store has registered gets `404 STORE_NOT_MAPPED`.
- **One frontend repo per store** (locked platform decision). Each storefront builds with Vite, is served by Caddy as its own Railway service, and **proxies `/api/*`, `/oauth2/*`, `/login/oauth2/*` from the shop's own domain** to the backend. This proxying is load-bearing for tenancy — see lesson L1.
- **Customer accounts are per store** (`unique(store_id, email)`). A customer of one shop does not exist on another.
- **Roles:** `CUSTOMER`, `STAFF`, `ADMIN` (per store), `PLATFORM_ADMIN` (operators; satisfies staff/admin checks everywhere by design). Admin/console access is a normal part of a storefront repo.
- **The admin console is visually neutral by design** (locked decision): only the *storefront* carries the store's brand. You reuse the console essentially as-is; you design the storefront.
- **Features are entitlement-gated per store** (§3.2). A store only sees what the platform has granted *and* the merchant has enabled. Your UI must gate on these flags at runtime — never by deleting code paths you might need later, and never by showing surfaces the store cannot serve.
- **Stack (do not change it):** React 18 + TypeScript + Vite + Tailwind + React Router v6 + TanStack Query, Vitest + React Testing Library, Caddy + Docker for deploy. `npm run build` runs `tsc && vite build` — the type-check gates deployment.

## 2. Phase 1 — Discovery (mandatory, before any code)

When the user says "Build a new store UI" (or similar), do **not** scaffold, do not propose file trees, do not write code. Enter discovery.

**How to ask:** batch related questions (one or two rounds, not twenty tiny ones). For every question, offer a sensible default so the user can answer fast. Ask about things that change what you build; decide cosmetic and implementation details yourself (§2.3).

### 2.1 The discovery questions

Business & identity:
1. **Store name** (and the slug they want, e.g. `green-fork`).
2. **What is the store about?** One paragraph in the owner's words.
3. **What does it sell** — physical products, bookable services, or both? Rough catalog size and structure (categories? brands? variants like size/color?).
4. **Who is the target customer?** (demographic, buying context, device expectations — mobile-first street traffic vs desktop B2B buyers.)
5. **Market/geography:** country, currency, language(s), timezone. (Currency and timezone are store settings the backend serves; your UI must not hardcode them.)
6. **Features the store needs** — walk them through the capability menu in §3.1 and record explicit yes/no/later for each. Do not silently enable everything.
7. **Which backend capabilities/entitlements should be on?** (§3.2 — includes online payments, bookings, WhatsApp, image upload/AI. Note which need platform-side grants and credentials.)
8. **What should the user journey lookk like?** Have them narrate a first-time customer's path from landing to purchase/booking. Probe for anything non-standard (quote requests? enquiry-first? appointment before purchase?).

Brand & design:
9. **Logo** (asset or "make a wordmark").
10. **Tagline.**
11. **Brand colors** (or "derive from the logo").
12. **Theme and visual style** — light or dark identity, tone (minimal/luxurious/playful/clinical), typography preferences.
13. **Design references** — real sites/apps they like, and what specifically they like about them.
14. **Store-specific requirements or workflows** — anything unique (minimum order values, delivery-area messaging, prescription upload, age gates, custom badges…). If it needs backend behavior that doesn't exist (§5 tells you what exists), flag it as out of scope for the UI and report it to the user instead of faking it client-side.

Operational (agents forget these; don't):
15. **Domains** the store will serve from (apex + www? subdomain? Railway hostname for staging?). Every one must be attached to the store in the platform console before it works (lesson L2).
16. **Payment methods:** cash on delivery, online (Razorpay), or both? Online needs the `onlinePaymentsAllowed` entitlement and store Razorpay credentials.
17. **Does this repo include the admin console?** Default **yes** (merchants need it); reuse it neutral. The platform console (`/platform`) is **not** needed in new store repos — operators use the flagship's.
18. **Who administers the store** — so first-admin bootstrap can be planned (backend `BOOTSTRAP_ADMIN_*` / membership grant; a deployment-handoff item, not a UI feature).

### 2.2 Discovery output: the Store Brief (approval gate)

Write a Store Brief the user approves before you build. It must contain:

- **Identity:** name, slug, tagline, logo treatment, color tokens (see §8.4), typography, light/dark identity.
- **Feature matrix:** every §3.1 capability with ON / OFF / LATER and the discovery answer that justifies it.
- **Page map:** every route you will build, one line each on purpose and content. Explicitly list amanly-store pages you are **not** building and why.
- **User journey:** the primary path(s) as short flow diagrams (landing → … → done), including the auth prompt points.
- **Entitlement + ops checklist:** which platform grants, credentials, and domain attachments the store needs (the user/platform does these; you list them).
- **Open assumptions:** whatever you decided without asking, stated so the user can veto.

If discovery answers change scope materially mid-build, update the Brief and reconfirm — don't drift silently.

### 2.3 Ask vs decide

**Ask** when it affects business behavior or brand: features on/off, journey shape, payment methods, anything customers pay for or are promised, brand identity, tone of copy, anything §14-style unusual.
**Decide yourself** (and note in the Brief): file structure, component composition, spacing/layout details, which kit component to use, test structure, loading-state design, standard UX conventions (sticky headers, breadcrumb shape), micro-copy that isn't brand voice.

## 3. Phase 2 — Scoping: what this store actually needs

### 3.1 The capability menu (all already built server-side)

| Capability | Backend surface exists for | Build the UI when |
|---|---|---|
| Product catalog | products, variants, brands, category tree, search/filter/sort, banners | the store sells goods |
| Cart & checkout | cart w/ stock reservation, coupons, addresses, shipping (flat + free threshold), single-rate tax (inclusive or exclusive), COD, Razorpay online payment | the store sells goods |
| Orders & account | order history/detail/cancel, saved addresses, profile, password, email verify, OAuth2 login | always (any account-based store) |
| Wishlist | ids + full list | catalog stores where browsing ≫ buying frequency |
| Product reviews | moderated reviews + summaries, verified-purchase | catalog stores wanting social proof |
| **Bookings/services** | service catalog, staff, availability, place/cancel/reschedule, walk-ins, business hours, settings, ICS/Google links, service reviews | the store takes appointments — governed by `docs/booking-ui-build-plan.md`; its contract rules are mandatory |
| Admin console | full management APIs: catalog, inventory, orders w/ filters, users/roles, coupons, banners, commerce settings, stats (commerce only), QR code, bulk CSV upload, image upload + AI studio, review moderation, booking management | default yes, reused neutral |
| Notifications | transactional email (Brevo HTTPS API — works), WhatsApp (needs entitlement + per-store Meta-approved template names) | server-side; your UI only sets expectations ("we'll email you") |

**Do not enable everything.** Every ON in the feature matrix must trace to a discovery answer. A services-only store gets no cart, PLP, or wishlist; a goods-only store gets no booking surface. Gate at runtime from `GET /api/v1/store` flags wherever the backend exposes one (`codEnabled`, `onlinePaymentEnabled`, `bookingsEnabled`), and by build scope for the rest.

### 3.2 Entitlements (platform-granted, per store)

Set via the platform console; several UI surfaces must check them or their public reflections: `onlinePaymentsAllowed`, `bookingsAllowed`, `whatsappNotificationsAllowed`, `whatsappCommerceAllowed`, `emailNotificationsAllowed`, `marketingEmailAllowed`, `customDomainAllowed`, `imageUploadAllowed`, `aiImageGenerationAllowed`, plus limits `maxStaffSeats`, `maxImageUploads`, `maxAiImageGenerations`.

The public store payload collapses these to effective flags (e.g. `bookingsEnabled` is already `allowed && enabled`). The admin store payload exposes them separately — keep "not in your plan" (contact platform) visually distinct from "switched off" (a toggle the merchant can flip).

### 3.3 Page catalog (superset from amanly-store — pick, don't copy)

Storefront: Home · PLP `/products` · PDP `/products/:slug` · Cart · Checkout · Orders + detail · Account (profile/password) · Addresses · Wishlist · auth pages (login, register, verify-email, forgot/reset password, oauth2-callback) · NotFound / StoreNotMapped. Bookings adds: `/services`, `/services/:slug`, `/book/:slug`, `/account/bookings` (+ detail).
Admin: dashboard, orders, inventory/products, categories, brands, coupons, banners, reviews, users/teams, reports, settings, QR code; bookings adds bookings/services/staff/settings/review-moderation pages.

Your store's page map is a *selection and re-composition* of this catalog plus anything genuinely new the journey needs. The Home page especially should be designed for this store's identity — amanly-store's Home is a reference, not a template.

## 4. Reuse vs store-specific

### 4.1 Reuse verbatim (the proven plumbing — copy, don't rewrite)

These encode months of fixes. Start your repo from the amanly-store skeleton and keep:

- `src/lib/http.ts` — the API client: base-URL resolution, auth header, **single-flight token refresh with rotation/reuse-detection safety**, `X-Store-Slug` claim discipline, `409 STORE_CONTEXT_STALE` recovery, `ApiError` with `code`/`fieldViolations`, `buildQuery()`, `TokenStore`/`StoreScope`. Cross-cutting behavior lives ONLY here; no component ever calls `fetch`.
- `src/api/*` modules for every capability you enable — typed, path-only, no error handling of their own. Public reads = named exports; admin = namespaced object with `{auth: true}`.
- `src/lib/types.ts` — the DTO mirror of the real Spring records. Trim to the capabilities you build, but never retype fields from guesswork; copy from the reference.
- `src/context/` — Auth (roles, OTP arm), Store (public-store bootstrap + `StoreGate`/`StoreNotMapped`), Toast, Theme; `src/components/guards.tsx` (RequireAuth/Staff/Admin with return-to state).
- Test harness: `vitest.config.ts`, `src/test/setup.ts`, `src/test/utils.tsx` (renderWithProviders), the mock-the-api-module pattern.
- Deploy shell: `Dockerfile`, `Caddyfile` (`reverse_proxy /api/* … {$API_UPSTREAM}`, `try_files {path} /index.html`, immutable `/assets/*`, no-cache `index.html`), Vite dev proxy with **`changeOrigin: false`**, command-based backend selection (`npm run dev:local` loads `.env.development`, `npm run dev:prod` loads `.env.production`), `API_PROXY_TARGET` for the proxy target, and comment-only `VITE_API_BASE_URL` warnings in `.env.*`.
- The admin console pages for enabled capabilities — neutral styling, minimal edits (nav trimmed to enabled features).
- Utilities: `src/lib/format.ts` (`money()`, date/zone helpers), `dateRange.ts`, `rowActivation.ts`, `usePageMeta`/`useDocumentTitle`.

### 4.2 Reuse as a starting point, restyle freely

The UI kit (`src/components/ui/*`): Button, Field, Input/Select/Textarea, Card, Badge, Modal/ConfirmDialog (Radix), Tabs, Drawer, DropdownMenu, Tooltip, Accordion, Stepper, DataTable, Pagination, SearchInput, FilterChip, QuantityStepper, PriceTag, RatingStars/Input, ImageWithFallback, Carousel, Breadcrumbs, skeletons, charts. Keep the **APIs and accessibility behavior**; reskin via the token layer (§8.4). Extending the kit for the new brand is expected; breaking its contracts is not. Keep a KitchenSink dev page.

### 4.3 Store-specific (design fresh, to the Brief)

Visual identity (palette, type, spacing personality, imagery, motion) · Home experience · page composition and section order · navigation structure and labels · copy and tone · empty-state illustrations/voice · which journey shortcuts exist (quick reorder, "book again", featured collections). The result should be recognizably a different shop, not a reskin.

## 5. Backend surface, in brief

Base `/api/v1`; JSON; auth via `Authorization: Bearer` (access ~15 min, refresh rotates). Full contract: `docs/storefront-api-guide.md`. Highlights and the facts you must not violate:

- **Bootstrap:** `GET /store` (public) → slug, name, currency, `codEnabled`, `onlinePaymentEnabled`, shipping/tax settings (`shippingFlatAmount`, `freeShippingThreshold`, `taxRatePercent`, `pricesIncludeTax`), hero copy fields, `bookingsEnabled`, `timezone`, `businessAddress`. First call of every session; cache under a stable query key; everything brand-ish and money-ish flows from it.
- **Auth:** login can return **202 `{status:"OTP_REQUIRED"}`** (platform operators) — 200 is not the only success. Refresh reuse-detection revokes the whole token family: never issue parallel refreshes.
- **Catalog:** paged lists with server-side filters/sort; PDP by slug; variants as option maps; banners require `?placement=` (`HOME_HERO`|`HOME_STRIP`|`PLP_STRIP`) and arrive pre-filtered by schedule — no client date math.
- **Cart/checkout:** server computes all totals (discount on goods only, free-shipping vs discounted subtotal, tax on goods+shipping, inclusive or exclusive). The cart total is **not** the payable total. Online payment returns `paymentAction.amountMinor` **already in minor units**; verification happens server-side; unpaid online orders are auto-cancelled after a timeout (a "payment window" is real — reflect it in copy).
- **Orders/account:** order history/detail/cancel; saved addresses CRUD; profile/password/email-verify.
- **Reviews:** moderated (submit → PENDING; edit resets to PENDING), verified-purchase computed server-side, summaries with zero-filled 1–5 buckets.
- **Bookings:** the availability endpoint is the only source of slot truth; every rule is in `docs/booking-ui-build-plan.md` §2 — treat that section as part of this playbook when bookings are on.
- **Errors:** one envelope everywhere — `{status, code, message, fieldViolations[], reference}`. `reference` only on 5xx. **Branch on `code`, never on `message` or bare status.** Cross-tenant or missing resources are `404` (never 403 — anti-enumeration, by design).
- **Rate limiting & lockout:** per-IP rate limits and enumeration-safe login lockout exist; show generic "try again later" messaging, never reveal whether an account exists.

## 6. Hard constraints (violating any of these is a defect)

1. **Serve and proxy from the store's own domain.** The UI never calls the backend's own origin from the browser; `VITE_API_BASE_URL` stays unset in real deployments. Dev mirrors prod via the Vite proxy with `changeOrigin: false`.
2. **Every serving address must be attached to the store** in the platform console — apex and `www` separately, Railway hostname, `localhost:5173`/`4173` for dev. Unattached ⇒ `404 STORE_NOT_MAPPED`; render a real "this address isn't a shop yet" page naming `window.location.host`; do not retry.
3. **Never attach the backend's own hostname to any store**, and never build a feature on the dev-only `X-Store-Slug` resolution toggle.
4. **Money is decimal strings** rendered via `money(amount, store.currency)` / `Intl.NumberFormat`; no `parseFloat` arithmetic, no hardcoded currency symbols. Only `amountMinor` is an integer, and it is already minor units.
5. **Time belongs to the store** for anything operational (hours, appointments): render with the store's IANA `timezone`, never the browser's. Order timestamps may use the browser zone.
6. **Full-replace PUTs are real** (commerce settings, booking settings, entitlements, several updates): always send the complete payload, loaded-then-edited; a form that submits before its GET resolves can erase data. Where the backend declares primitive/`@NotNull` fields, absence is a 400 `MALFORMED_REQUEST` — send every field, always.
7. **Storage is namespaced per store** and localStorage-based (`Authorization` header, no cookies) — two stores on `localhost` must not share tokens/carts.
8. **Type additively for deploy skew:** new fields on shared DTOs are optional in TS (`bookingsEnabled?`), and `undefined` fails closed (feature off), because cached payloads and staggered deploys are normal.
9. **All UI states exist for every remote read:** loading skeleton, error state, empty state, populated — and "empty" is designed, not a blank div (§8.1).
10. **The type-check is the deploy gate:** the repo must always pass `tsc` and its test suite; a red state never ships or persists.

## 7. Known-lessons register — mistakes already made and fixed once

Each entry: the mistake → the rule. These were paid for in production incidents, failed deploys, and debugging days on amanly-store and the backend. **Check your work against this list at every milestone review.**

- **L1 — Shared API origin broke tenancy.** Calling the backend's origin directly resolved every request to the wrong shop (or, now, a 404). *Rule:* proxy from the shop's domain (§6.1); Caddy preserves `Host` by default; Vite dev uses `changeOrigin: false`.
- **L2 — The fallback store served the wrong catalog with HTTP 200.** A misconfigured domain looked like a working shop selling another merchant's goods. The fallback was removed platform-wide. *Rule:* unmapped ⇒ explicit 404 page; attach every origin first (§6.2); accept both `STORE_NOT_MAPPED` and the older `STORE_NOT_FOUND` code so one build works across deploys.
- **L3 — `X-Store-Slug` misuse.** It is a *claim*, not an instruction: send the slug learned from `GET /store` on authenticated/non-GET requests only (a custom header on every GET forces CORS preflights per path); never on the bootstrap call. On `409 STORE_CONTEXT_STALE`: clear the stored slug, retry the same request once with the claim explicitly disabled, refetch `/store`. The user should notice nothing.
- **L4 — Parallel token refreshes logged users out mid-checkout.** Refresh rotation + reuse detection treats a second concurrent refresh as theft. *Rule:* single shared in-flight refresh promise; retry the original request once; always persist the newest refresh token. (Already correct in `http.ts` — don't reimplement it.)
- **L5 — Branching on error `message` broke when copy changed.** *Rule:* branch on `code`; map `fieldViolations` to fields; show `reference` only for 5xx support flows.
- **L6 — Treating 404 as a bug.** Cross-tenant reads 404 by design (anti-enumeration). *Rule:* 404 on an id you "know exists" usually means wrong store context, not a missing row.
- **L7 — Missing `CORS_ALLOWED_ORIGINS`** on the backend for a new frontend origin ⇒ *every* browser request fails preflight, which presents as "the whole API is down". *Rule:* deployment checklist item, along with `APP_FRONTEND_BASE_URL`.
- **L8 — Required-boolean cross-repo break (Jackson 3).** The backend rejects request bodies missing primitive booleans (`MALFORMED_REQUEST` naming the field). A new required boolean on a shared DTO broke the older UI. *Rule:* send complete payloads (§6.6); when the backend adds required fields, the UI must gain them in the same release window.
- **L9 — Login treated 200 as the only success** — platform operators get 202 OTP. *Rule:* handle both arms (the AuthContext already does).
- **L10 — Payment amount double-converted.** `amountMinor` is already paise; multiplying by 100 charged 100×. *Rule:* §6.4; never do money math client-side; server-side verification is the only truth for "paid".
- **L11 — Cart total presented as payable** (excludes shipping/tax) and **tax shown twice** when `pricesIncludeTax`. *Rule:* the server's totals object is the only breakdown; render inclusive/exclusive per the flag.
- **L12 — Unlabelled form controls.** The shared `Field` renders its label without `htmlFor`, so every control inside it is invisible to screen readers and `getByLabelText`. *Rule:* explicit `aria-label` on every control inside `Field`; tests query by role/label. (Fixing `Field` itself touches every page — coordinate before attempting.)
- **L13 — Booking suite traps** (each one already cost a fix): computing slots client-side; rendering appointment times in the browser zone; auto-retrying a booking 409; `<a href>` on the Bearer-authed `.ics` (use fetch + blob; prefer the `googleCalendarUrl` anchor); treating empty availability as an error (closed days looked like outages); showing the services surface when `bookingsEnabled` is false (a page of 404s); mutating the offered `startsAt` string before POSTing it back. *Rule:* obey `docs/booking-ui-build-plan.md` §2 verbatim.
- **L14 — Reviews surprise-vanish.** Submissions are moderated (land PENDING) and editing an approved review resets it to PENDING. *Rule:* say so in the UI at submit and before edit, or users resubmit repeatedly.
- **L15 — Banner endpoint called bare** — `placement` is required (400 otherwise), and the backend already applied scheduling. *Rule:* always pass placement; no client-side date filtering.
- **L16 — Image upload / AI generation quirks.** The external services report failure *inside* HTTP 200 and validate nothing; AI generation takes ~10 s/image; both are stage-verified only. *Rule:* parse response bodies for real success, validate files client-side (type/size), design for long waits, and treat these admin features as optional per entitlements.
- **L17 — Client-side stats at scale.** There are no server aggregates for some dashboards; amanly-store aggregates list endpoints client-side. Acceptable for a day of bookings or a page of orders; **never page months of data into the browser for a trend**. If a chart needs history, cut the feature or request a backend endpoint.
- **L18 — Deep links 404ing in prod.** React Router owns every path only because Caddy has `try_files {path} /index.html`. *Rule:* keep it; new routes need no server change; never remove the hashed-assets/immutable + index/no-cache split.
- **L19 — Local dev not attached.** `localhost:5173` must be an attached address of the dev store or the SPA boots into `STORE_NOT_MAPPED`. *Rule:* verify before assuming the backend is broken.
- **L20 — No theme endpoint exists.** Per-store branding is a frontend concern (a backend theme API is planned but paused). *Rule:* one theme module/token layer keyed by the store (§8.4), so a future API swap is one change.
- **L21 — "Stale memory" configuration edits.** More than once, config was edited from remembered state instead of verified state (a Flyway checksum incident took prod down). *Rule for you:* before changing deployment config or shared contracts, verify current reality (call the endpoint, read the env, run the query) — never trust a doc or your recollection over the running system.

## 8. Quality bar

### 8.1 The four states, everywhere
Every remote read renders: **loading** (skeletons matching final layout — no spinner-only pages), **error** (friendly copy + retry where sensible; `code`-driven special cases), **empty** (designed, on-brand, with a next action — "No products yet" ≠ bug), **populated**. Every mutation: pending (disabled + progress), success (toast/inline), failure (field violations mapped; generic toast otherwise). TanStack Query defaults in the reference: `retry: 1`, `refetchOnWindowFocus: false`, `staleTime: 30s` — override deliberately (availability-style data wants seconds + focus refetch).

### 8.2 Responsive & accessible
Mobile-first; test 360 px, 768 px, 1280 px minimum. Tables scroll in their own container or collapse to cards; filters move into a Drawer on small screens; touch targets ≥ 44 px. Keyboard: every interactive element reachable and operable; wizard steps move focus to their heading; Radix-backed kit pieces keep their focus traps. Labels per L12. Color contrast AA against your new palette — validate the palette, don't eyeball it.

### 8.3 Performance & meta
Every route lazy (`React.lazy` + Suspense skeletons — the reference pattern); images `ImageWithFallback` with dimensions to avoid layout shift; no new heavy dependencies without justification (the reference deliberately has no date library). Per-page `useDocumentTitle` + `usePageMeta` (description, canonical).

### 8.4 Theming mechanics (how a new identity is applied safely)
The reference styles through **role tokens** — Tailwind classes that resolve via CSS variables (`bg-primary`, `text-primary-fg`, ink scale, banner/band surfaces) — and components never hardcode literal colors. To rebrand: redefine the token values (palette, radii, fonts) for the new store; keep the token *names* so every reused component re-skins itself. Dark/light: `ThemeProvider` is the only writer of the `dark` class; the admin console claims its dark palette via `useDarkTheme()`. Choose the storefront's identity (light, dark, or both) in the Brief and implement it through this mechanism only.

## 9. Build workflow

1. **Scaffold** from the amanly-store skeleton: keep §4.1 verbatim, keep §4.2 kit, delete pages/features outside the Brief, strip `/platform`, rename brand constants, set the token layer to the new palette.
2. **Milestones, riskiest first, always green:** M0 boot + store bootstrap + proxy + 404/maintenance pages → M1 auth → M2 primary catalog/booking browse → M3 transaction path (cart/checkout or booking wizard) → M4 account surfaces → M5 admin trim → M6 polish + states + a11y. Each milestone: type-check, tests, and a runnable app.
3. **Tests as you go**, reference conventions: colocated `*.test.tsx`, mock `@/api/*` modules (not fetch), typed fixture factories, `renderWithProviders`. Cover: gating (feature off ⇒ surface absent), the transaction happy path, the top error paths (409s, cutoffs, payment failure), and any logic you wrote (formatters, reducers).
4. **Keep the repo's `ARCHITECTURE.md`** (start from the reference's): every api module's exports, every route, conventions. Agents after you depend on it the way you depended on amanly-store's.
5. **Report honestly:** what's built, what's tested, what's assumed, what's blocked. Never mark the store done with a failing check "to fix later".

## 10. Validation — definition of done

**Static:** `npm run build` green (tsc gate) · `npx vitest run` green · no console errors in a browsing session.

**Store-context drills:** boots on an attached dev origin with real store name/currency · unattached origin ⇒ the StoreNotMapped page · 503 ⇒ maintenance page · auth survives a token expiry (silent refresh, one retry, no logout storm).

**Per enabled feature, end-to-end against a real backend** (dev/stage): sign-up → verify → sign-in → password reset · browse with filters/pagination/deep-link refresh (L18) · cart math vs server totals incl. coupon + free-shipping threshold + tax mode · COD order placed and visible in account + admin · online payment in sandbox: success, failure, and abandonment (order auto-cancels; stock returns) · addresses CRUD prefilling checkout · reviews submit→moderate→appear · wishlist persistence · bookings (if on): the full drill list in `docs/booking-ui-build-plan.md` §8 — 409 double-book, closed-day empties, cancel/reschedule, calendar links · admin: each enabled console page loads real data and its mutations invalidate correctly.

**Feature-off regression:** every capability the Brief left OFF is truly absent — no nav items, no routes, no dead links, no 404-generating surfaces.

**Deployment handoff checklist** (produce it filled-in for the user):
- [ ] Railway service created; Docker build green; `API_UPSTREAM` set
- [ ] All serving domains attached to the store in the platform console (apex, www, Railway hostname; dev origins for local work)
- [ ] Backend `CORS_ALLOWED_ORIGINS` includes every serving origin; `APP_FRONTEND_BASE_URL` set
- [ ] Entitlements granted per the Brief; merchant credentials configured (Razorpay if online payments; WhatsApp templates if WhatsApp)
- [ ] First store admin bootstrapped; admin console reachable at `/admin` with the separate login rules
- [ ] Smoke: one real transaction on the live domain

---

## Appendix A — reference file map (amanly-store)

`src/App.tsx` all routes · `src/main.tsx` provider stack · `src/lib/http.ts` client/TokenStore/StoreScope · `src/lib/types.ts` DTO mirror · `src/lib/format.ts` money/dates · `src/api/*` one module per capability (`banners.ts` is the cleanest template) · `src/context/*` Auth/Store/Toast/Theme(+Cart/Wishlist) · `src/components/guards.tsx` route guards · `src/components/ui/*` kit + `index.ts` barrel · `src/components/layout/*` Store/Admin/Auth layouts · `src/pages/store|admin|auth/*` pages (Checkout.tsx = wizard pattern; Products.tsx = URL-state filters; AdminOrders/AdminOrderDetail = console list/detail pair; Brands.tsx = CRUD-with-modal pattern) · `src/test/*` harness · `Caddyfile`/`Dockerfile` deploy · `ARCHITECTURE.md` the contract.

## Appendix B — authoritative docs (backend repo `docs/`)

`storefront-api-guide.md` (full HTTP contract) · `store-identification-ui-guide.md` (tenancy — authoritative) · `booking-ui-build-plan.md` (booking UI plan + contract rules) · `parlour-ui-implementation-plan.md` (booking route/role inventory) · `storefront-ui-implementation-guide.md` (foundations/traps essay) · `multi-store-redesign.md` (platform program + locked decisions) · `hosting-plan.md` (deployment).
