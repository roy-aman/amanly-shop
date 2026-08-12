# Building a storefront on Royal Commerce — a guide for AI agents

**Audience:** an agent asked to build a web frontend for one shop running on this backend.
**You do not need to read the backend source.** Everything required is here. Where a detail is not,
the running server publishes an OpenAPI spec at `/api-docs` and a browser UI at `/swagger-ui` —
prefer those over guessing.

**Read §1 before writing any code.** It contains the one idea that makes this backend different
from a single-shop API, and getting it wrong produces a frontend that works in development and
serves the wrong shop's data in production.

---

## 1. One backend, many shops

This is a **multi-tenant** API: a single deployment serves many independent shops. Amanly and Nova
Sports run on the same server, the same database and the same code, but they have separate
catalogues, separate orders, separate customers and separate admins. Neither can see the other.

**The shop is chosen by the hostname you call, not by anything you send.**

```
GET https://amanly.in/api/v1/products      → Amanly's products
GET https://novasports.in/api/v1/products  → Nova Sports' products
```

Same path, same code, different shop. There is no `storeId` parameter on any storefront endpoint,
and you must not invent one. The backend reads the `Host` header — which the browser sets and page
JavaScript cannot forge — and scopes every query to whichever shop owns that domain.

Three consequences that shape your frontend:

1. **Never hardcode shop identity.** Not the name, not the logo, not the currency, not the tagline.
   Fetch it (§4). The same bundle is expected to serve several shops.
2. **Key any persisted state by shop.** `localStorage`, IndexedDB, service-worker caches — prefix
   them with the store's `slug` from `GET /api/v1/store`. Two shops on one browser under one key
   will show each other's cart.
3. **A login is valid at one shop only.** See §3.

> **Precedent.** This is how Shopify, Slack and Atlassian all work: `acme.myshopify.com` and
> `acme.slack.com` identify the tenant in the hostname. If you have built against Shopify's Storefront
> API, the mental model transfers directly.

### 1.1 Running locally

Locally you are on `http://localhost:5173`, which is nobody's shop domain, so host-based resolution
cannot work. Two options:

**Option A — the fallback store (simplest).** With no matching host, the backend falls back to the
store whose slug is `default` (configurable via `APP_TENANT_FALLBACK_SLUG`). Point your dev server
at the API and you get that shop. Fine for building one storefront.

**Option B — choose a shop by header.** The operator sets
`APP_TENANT_ALLOW_HEADER_RESOLUTION=true`, and you send:

```http
X-Store-Slug: nova
```

The header is **ignored in production** and the server refuses to start with it enabled under the
`prod` profile — it is caller-supplied, so trusting it would let anyone address any tenant. Use it
for local multi-shop testing only, and do not build product features that depend on it.

### 1.2 Deployment — the part that decides whether tenancy works at all

Each shop gets its own frontend repository and its own deployment. **How that deployment reaches the
API determines whether the backend can tell which shop is calling**, so this is not a devops detail
you can settle later.

**Required: serve the SPA and proxy `/api/*` from the shop's own domain.**

```
Browser ──► https://novasports.in/          ──► static SPA bundle
Browser ──► https://novasports.in/api/v1/…  ──► reverse_proxy ──► backend
                                                Host: novasports.in  ✅ resolves to Nova Sports
```

A Caddyfile that does it:

```caddy
:{$PORT:80} {
	root * /srv
	encode gzip zstd

	# Everything under /api and /oauth2 goes to the backend. Caddy preserves the original
	# Host header by default, which is the whole point: the backend picks the shop from it.
	reverse_proxy /api/* /oauth2/* {$API_UPSTREAM}

	# React Router owns every other path; a deep link must return index.html, not 404.
	try_files {path} /index.html
	file_server

	@assets path /assets/*
	header @assets Cache-Control "public, max-age=31536000, immutable"
	@html path /index.html /
	header @html Cache-Control "no-cache"
}
```

**Why not just call `https://api.royalcommerce.app` directly from the browser?** Because then the
`Host` the backend sees is `api.royalcommerce.app` — which belongs to no shop — and **every request
resolves to the fallback store**. Nova Sports' storefront would quietly serve Amanly's catalogue.
It fails silently and it fails in the worst possible direction, so do not do it. Three further
benefits of proxying: no CORS at all, no per-shop API origin baked into the bundle at build time,
and no backend redeploy when a shop is added.

If a client genuinely cannot proxy — a mobile app, a server-side integration — it must reach the
shop by a hostname that belongs to it (its own domain or its `slug` subdomain), and the operator
must add that origin to `app.security.cors.allowed-origins`. Out of the box that list holds
`http://localhost:5173`, `http://localhost:4173`, `http://localhost:3000`, and `https://amanly.in` /
`https://amanly.shop` with their `www` variants. A missing entry fails preflight with an error that
looks exactly like the API being down.

**Behind the proxy, set `server.forward-headers-strategy`** on the backend (the `prod` profile
already does). Without it every request appears to come from the proxy's IP, and per-IP rate
limiting collapses every customer of every shop into one shared bucket.

---

## 2. Conventions

**Base path:** every endpoint below is under `/api/v1`.

**Auth:** send `Authorization: Bearer <accessToken>`. Endpoints marked 🔓 are public.

**Errors** are always this shape, with the HTTP status echoed in the body:

```json
{
  "timestamp": "2026-08-08T12:00:00Z",
  "status": 409,
  "error": "Conflict",
  "code": "EMAIL_ALREADY_REGISTERED",
  "message": "Email is already registered",
  "path": "/api/v1/auth/register",
  "fieldViolations": [{ "field": "password", "message": "must contain uppercase, ..." }]
}
```

Branch on `code`, never on `message` — messages are prose and will change. `fieldViolations` is
populated for validation failures; map it onto your form fields.

**A 404 may mean "not yours".** If a request names a resource belonging to another shop, the API
answers `404 RESOURCE_NOT_FOUND`, not `403`. Answering "forbidden" would confirm the record exists
and let someone enumerate a competitor's ids. GitHub does the same for private repositories. Treat
404 as "not found" and move on.

**Pagination** uses Spring's standard page object. Send `?page=0&size=20&sort=createdAt,desc`;
receive:

```json
{
  "content": [ ... ],
  "totalElements": 137,
  "totalPages": 7,
  "number": 0,
  "size": 20,
  "first": true,
  "last": false
}
```

**Money** is decimal (`"1299.00"`), not minor units — except `paymentAction.amountMinor` at
checkout, which is paise for Razorpay. Currency comes from the store, not from a constant.

---

## 3. Authentication

Accounts are **global**: one account per person across the whole platform, like an Amazon or
Flipkart account that works with every seller. What differs per shop is the person's *roles* and
their cart, orders and wishlist.

Three things follow, and all three are easy to get wrong:

- **Registering an email that already exists fails with 409 `EMAIL_ALREADY_REGISTERED`, even if the
  person has never used this shop.** That is correct, not a bug: silently attaching a new signup to
  an existing identity would let anyone who knows the address take the account over. Your UI should
  say *"you already have an account — sign in"*, not *"that email is taken"*.
- **Signing in at a shop the person has never used just works**, and quietly makes them a customer
  of it. There is no "join this shop" call to make.
- **The address book is shared across shops.** An address saved at one shop appears at another's
  checkout. Convenient, and worth a word in your UI so it does not read as a leak.

| Method | Path | |
|---|---|---|
| POST | `/auth/register` | 🔓 `{ email, fullName, password }` |
| POST | `/auth/login` | 🔓 `{ email, password }` — 200 with a session, or **202** for a platform operator (see below) |
| POST | `/auth/login/verify-otp` | 🔓 `{ email, code }` — second step for platform operators only |
| POST | `/auth/refresh` | 🔓 `{ refreshToken }` |
| POST | `/auth/logout` | `{ refreshToken }` |
| POST | `/auth/forgot-password` | 🔓 `{ email }` |
| POST | `/auth/reset-password` | 🔓 `{ token, newPassword }` |
| POST | `/auth/email-verification/resend` | 🔓 `{ email }` |
| POST | `/auth/email-verification/verify` | 🔓 `{ token }` |
| GET | `/auth/providers` | 🔓 Which social logins are configured — hide the Google button when absent |

`register`, `login` and `refresh` all return:

```json
{
  "tokenType": "Bearer",
  "accessToken": "eyJ...",
  "expiresInSeconds": 900,
  "refreshToken": "...",
  "user": { "id": "...", "email": "...", "fullName": "...", "provider": "LOCAL",
            "status": "ACTIVE", "roles": ["CUSTOMER"], "emailVerifiedAt": null,
            "createdAt": "...", "updatedAt": "..." }
}
```

**Password rules on registration:** 12–72 characters, and must contain lowercase, uppercase, a
digit and a special character. Validate client-side too or users will hit a 400 they don't expect.

**Access tokens are short-lived (~15 min).** Refresh proactively before expiry and reactively on a
401, and **serialise refreshes** — if five requests 401 at once and each fires its own refresh, the
rotation below revokes the whole session. Keep a single in-flight refresh promise that all callers
await.

**Refresh tokens rotate and detect reuse.** Each refresh returns a new refresh token and invalidates
the old one. Presenting an already-used token revokes every active token for that user — a stolen
token cannot be replayed, but neither can a token you accidentally kept. Always store the newest.

**Platform operators sign in in two steps.** If the account holds `PLATFORM_ADMIN`, `/auth/login`
answers **202** with `{ status: "OTP_REQUIRED" }` instead of a session, and the code goes to
`/auth/login/verify-otp`. Ordinary customers never see this. If you are only building a storefront
you can treat 202 as an error you will not encounter — but do not assume 200 is the only success.
Full detail in `platform-console-guide.md`.

**A token is only valid at the shop that issued it**, even though the account is shared. Tokens
carry the store they were minted for and the API rejects one presented at a different shop before it
touches the database — so keep token storage namespaced by shop slug. The person signs in again at
the second shop with the same credentials; they do not get one token for everything.

**`user.roles` in the login response is per shop.** The same account can come back as `["ADMIN"]` at
one shop and `["CUSTOMER"]` at another. Never cache roles across shops, and never decide what to
render from a role you read somewhere else.

---

## 4. Bootstrapping — call this first

```http
GET /api/v1/store        🔓
```

```json
{
  "slug": "nova",
  "name": "Nova Sports",
  "currency": "INR",
  "codEnabled": true,
  "onlinePaymentEnabled": true,
  "shippingFlatAmount": "49.0000",
  "freeShippingThreshold": "999.0000",
  "taxRatePercent": "18.000",
  "pricesIncludeTax": true
}
```

Everything here drives the UI and none of it may be assumed:

- `slug` — the key to namespace all client-side storage with.
- `name`, `currency` — page title, headings, money formatting.
- `codEnabled` / `onlinePaymentEnabled` — **which payment options to render at checkout.** Offering
  a method the shop has not configured produces an order that cannot be paid.
- `shippingFlatAmount` / `freeShippingThreshold` — the delivery cost and the "free delivery over
  ₹999" message. `freeShippingThreshold: null` means never automatically free.
- `taxRatePercent` / `pricesIncludeTax` — label prices `incl. tax` or `+ tax at checkout`
  accordingly. Getting this backwards is a consumer-law problem, not a cosmetic one.

> **Not available yet:** there is no branding/theme endpoint. Logo, colours, fonts and layout
> template are planned (see `multi-store-redesign.md`, work package T5) and **do not exist today**.
> Do not invent `/api/v1/storefront/theme` — it will 404. For now, per-shop visual identity is
> configured in your frontend. Structure it as a single theme module fed by the store `slug` so
> that swapping to the API later is one change.

---

## 5. Catalogue 🔓

| Method | Path | Notes |
|---|---|---|
| GET | `/products` | Paged search. Query: `categoryId`, `brandId`, `minPrice`, `maxPrice`, `search`, `tag`, plus paging. Only ACTIVE products. |
| GET | `/products/top` | Best sellers by units sold across paid orders. `categoryId`, `limit` (1–50, default 8). Empty until something sells. |
| GET | `/products/{slug}` | Full product. 404 if missing or not active. |
| GET | `/categories` | Flat list |
| GET | `/categories/tree` | Nested tree — use for navigation |
| GET | `/categories/{slug}` | One category |
| GET | `/brands` | Active brands |

`/products` returns `ProductSummaryResponse` — enough for a card:
`id, name, slug, sku, price, compareAtPrice, currency, status, categoryName, brandId, brandName,
primaryImageUrl, stockQuantity, ratingAvg, ratingCount`.

`/products/{slug}` returns the full `ProductResponse`, adding `description, shortDescription,
categoryId, categorySlug, weight, sellingUnit, tags, images[], variants[], createdAt, updatedAt`.

**Variants change how you add to cart.** If `variants` is non-empty, the shopper must pick one and
you send its `variantId`; product-level `stockQuantity` is not the number to trust — each variant
carries its own. If `variants` is empty, the product is variantless and `variantId` is omitted.
Build the picker from `variants[].options`.

`compareAtPrice` is the struck-through "was" price. Show it only when it is greater than `price`.

---

## 6. Cart 🔒

All require authentication — **there is no guest cart.** Prompt for sign-in before "add to cart", or
you will strand shoppers at a 401 mid-flow.

| Method | Path | Body |
|---|---|---|
| GET | `/cart` | |
| POST | `/cart/items` | `{ productId, variantId?, quantity }` |
| PUT | `/cart/items/{productId}?variantId=` | `{ quantity }` — absolute quantity, 1–1000, not a delta |
| DELETE | `/cart/items/{productId}?variantId=` | |
| DELETE | `/cart` | Empty the cart |

Note the asymmetry: **`variantId` is a query parameter on update and delete**, but a body field on
add. A cart can hold several lines for one product — one per variant — so omitting it on update
targets the variantless line and will not find a variant line.

`CartResponse`: `cartId, userId, items[], totalAmount, currency`. Each item has `cartItemId,
productId, productName, productSlug, sku, variantId, variantSku, variantOptionsLabel, quantity,
unitPrice, subtotal, reservationRemainingMinutes`.

**`reservationRemainingMinutes` is a real countdown.** Adding to the cart reserves stock for about
15 minutes; when it lapses the item is released and can be bought by someone else. Surface it —
shoppers who don't know it exists lose carts and blame the shop.

**`totalAmount` is goods only.** Shipping, tax and any discount are computed by the server at
placement (§7). Do not present the cart total as the amount payable; compute an estimate from the
`/store` values if you want one before checkout, and treat the order response as authoritative.

---

## 7. Checkout & orders 🔒

| Method | Path | |
|---|---|---|
| POST | `/orders` | Place an order from the server-side cart |
| GET | `/orders` | Paged order history |
| GET | `/orders/{orderId}` | One order |
| POST | `/orders/{orderId}/cancel` | Cancel while still cancellable |
| POST | `/coupons/validate` | Preview a discount before placing — `{ code, subtotal }` |

**Place order:**

```json
{
  "shippingAddress": { "recipientName": "...", "phone": "...", "addressLine1": "...",
                       "addressLine2": null, "city": "...", "state": "...",
                       "postalCode": "...", "country": "..." },
  "notes": null,
  "paymentMethod": "CASH",
  "couponCode": "SAVE10"
}
```

The order is built from the **server's** cart — you do not send line items, which is what stops a
tampered client from buying at its own prices. An invalid `couponCode` **rejects the order** rather
than being silently dropped, so validate it first with `/coupons/validate` and show the outcome.

`POST /coupons/validate` takes `{ code, subtotal }` and returns
`{ valid, code, reason, message, subtotal, discountAmount, total }`. On rejection `valid` is false
and `reason` is a machine-readable enum — render your own copy from it rather than the `message`.
This is a **preview only**: the server re-checks the coupon at placement, so a coupon that passes
here can still fail if its usage limit is reached in between.

`OrderResponse` returns the full money breakdown: `totalAmount, subtotalAmount, discountAmount,
shippingAmount, taxAmount, taxRatePercent, taxInclusive, couponCode, currency`, plus `status`,
`paymentStatus`, `shippingAddress`, `items[]`, and `paymentAction`.

Read the totals exactly as documented: when `taxInclusive` is **false**,
`total = subtotal − discount + shipping + tax`; when **true**, tax is already inside the prices and
`total = subtotal − discount + shipping`. Rendering an inclusive-tax order as if it were exclusive
double-counts the tax on screen.

### Online payment (Razorpay)

When `paymentMethod` is an online method and the shop has Razorpay configured, the response carries:

```json
"paymentAction": { "provider": "RAZORPAY", "razorpayKeyId": "rzp_...",
                   "razorpayOrderId": "order_...", "amountMinor": 129900, "currency": "INR" }
```

Open Razorpay Checkout with those values — `amountMinor` is already in paise, do not multiply — then
confirm with `POST /payments/razorpay/verify`. The shop's key id arrives in this response; never
hardcode it, it differs per shop.

**Payment is also confirmed server-side by webhook**, so treat your verify call as a UX nicety, not
the source of truth. Poll or re-fetch the order for `paymentStatus`. An unpaid online order is
auto-cancelled after ~30 minutes and its stock released; COD orders are untouched.

---

## 8. Customer account 🔒

| Method | Path | |
|---|---|---|
| GET | `/users/me` | Current user |
| PATCH | `/users/me/profile` | `{ fullName }` |
| PATCH | `/users/me/password` | `{ currentPassword, newPassword }` |
| GET/POST | `/users/me/addresses` | List / create |
| PUT | `/users/me/addresses/{id}` | Update |
| PATCH | `/users/me/addresses/{id}/default` | Make default |
| DELETE | `/users/me/addresses/{id}` | Delete |
| GET | `/users/me/wishlist` | `ProductSummaryResponse[]` — the same card shape as `/products` |
| GET | `/users/me/wishlist/ids` | `UUID[]` — use this to paint heart icons on listings |
| POST/DELETE | `/users/me/wishlist/{productId}` | Add / remove |

Address shape: `label, recipientName, phone, addressLine1, addressLine2, city, state, postalCode,
country, makeDefault`. Prefill checkout from the default address.

Fetch `/wishlist/ids` once per session rather than calling the wishlist endpoint per product card.

---

## 9. Reviews

| Method | Path | |
|---|---|---|
| GET | `/products/{productId}/reviews` | 🔓 Paged, approved only |
| GET | `/products/{productId}/reviews/summary` | 🔓 Average and per-star counts |
| POST | `/products/{productId}/reviews` | 🔒 `{ rating, title, body }` |
| PUT | `/products/{productId}/reviews/mine` | 🔒 Edit own |
| GET | `/products/{productId}/reviews/mine` | 🔒 Own review, if any |

One review per customer per product. New reviews are **moderated** — they will not appear in the
public list immediately, so say so after submitting or it reads as a bug.
`verifiedPurchase` is server-computed from delivered orders; display it, don't send it.

---

## 10. Admin surface 🔒

Only build this if asked. Roles are `CUSTOMER`, `STAFF`, `ADMIN`; check `user.roles` from the login
response and route accordingly. Products, categories, brands, coupons, orders, reviews and stats are
`STAFF`+`ADMIN`; user management and store settings are `ADMIN` only.

- `/admin/products`, `/admin/products/{id}/variants`, `/admin/categories`, `/admin/brands`
- `/admin/orders` — filters: `status`, `paymentStatus`, `userId`, `dateFrom`, `dateTo`, `search`
- `/admin/coupons`, `/admin/reviews` (approve/reject)
- `/admin/stats/overview|revenue-series|top-products|low-stock`
- `/admin/users` — list, create STAFF/ADMIN, roles, lock/unlock, disable/enable
- `/admin/store` — read settings; `PUT` payment / commerce / whatsapp settings

An admin sees **only their own shop**, automatically. There is no shop selector and no cross-shop
view; that is the platform surface below.

---

## 11. Platform surface — creating shops 🔒 `PLATFORM_ADMIN`

Not part of a storefront. Included so you know it exists and don't try to create a shop from the
admin API, which cannot.

| Method | Path | |
|---|---|---|
| GET | `/platform/stores` | Every shop |
| GET | `/platform/stores/{id}` | One shop |
| POST | `/platform/stores` | `{ slug, name, currency?, customDomain?, adminEmail?, adminFullName?, adminPassword? }` |
| PATCH | `/platform/stores/{id}` | `{ name?, customDomain?, status? }` — `status` is `ACTIVE`/`SUSPENDED`/`CLOSED` |

Creating a shop with `adminEmail` + `adminPassword` also creates its first `ADMIN`, which is what
makes it sign-into-able. `PLATFORM_ADMIN` cannot be granted through the admin user API by design, so
a shop owner can never reach another shop. There is no delete — `CLOSED` stops a shop trading and
is reversible.

A `SUSPENDED` or `CLOSED` shop returns **503 `STORE_UNAVAILABLE`** to every storefront request.
Render a maintenance page for that code rather than a generic error.

---

## 12. Checklist before you call it done

- [ ] Nothing about the shop is hardcoded — name, currency, payment methods and tax labelling all
      come from `GET /api/v1/store`.
- [ ] All client-side storage is namespaced by the store `slug`.
- [ ] Tokens are stored per shop; a token is never sent to a different shop's origin.
- [ ] Exactly one refresh request can be in flight at a time.
- [ ] Checkout renders only the payment methods the shop actually enabled.
- [ ] Order totals are read from the order response, honouring `taxInclusive`.
- [ ] `reservationRemainingMinutes` is surfaced in the cart.
- [ ] Variant products cannot be added to cart without a `variantId`.
- [ ] 404 is handled as "not found", 503 `STORE_UNAVAILABLE` as a maintenance page, and errors are
      branched on `code`.
- [ ] The shop's production domain has been added to the API's CORS allowlist.

---

## 13. Status of this document

Written 2026-08-08 against the state of the backend at that date. The multi-tenancy behaviour
described in §1 and §3 is implemented and unit-tested, but **has not yet been exercised against a
running database with two live shops** — the operator's verification gate (`T0` in
`multi-store-redesign.md`) is still open. If something behaves differently from this document, trust
the running server and `/swagger-ui`, and report the discrepancy rather than working around it.

The branding/theme API (§4) is designed but not built. Until it lands, a per-shop look is your
frontend's responsibility.
