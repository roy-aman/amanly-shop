# Building the platform console — a guide for AI agents

**Audience:** an agent adding a platform-operator console to a storefront frontend (the Amanly SPA).
**Companion document:** `storefront-api-guide.md` covers the shopping side — products, cart,
checkout, customer accounts. This one covers only what a *platform operator* does. Read that one
first if you are also touching the storefront.

**What you are building.** A `/platform` area inside the existing store frontend. When a platform
operator signs in at that store, they get an extra section for managing every store on the
platform. Everyone else never sees it.

---

## 1. The idea in one paragraph

One backend serves many stores. A **store admin** runs one shop. A **platform operator**
(`PLATFORM_ADMIN`) runs the service the shops sit on: they create stores, decide what each store is
allowed to use, and manage the hostnames stores answer on. An operator is not a member of any
merchant's store — their access comes from the role — so they can sign in at *any* store's domain
with one credential, and their session works everywhere.

---

## 2. Signing in — this is the part that differs

Ordinary sign-in is one step. A platform operator's is **two**, because their credential reaches
every merchant on the platform and a password alone is not enough for that.

```
POST /api/v1/auth/login   { email, password }
│
├─ 200  → AuthResponse           ordinary user; you have a session, done
│
└─ 202  → { "status": "OTP_REQUIRED",
            "message": "Enter the code we sent to your email…",
            "otp": "483920" }    ← DEV ONLY, see §2.2
     │
     └─ POST /api/v1/auth/login/verify-otp   { email, code }
          └─ 200 → AuthResponse   now you have a session
```

**Branch on the status code, not the body shape.** `200` means signed in. `202` means "correct
password, now prove it's you". Nothing about the request says which will happen — the same form
posts both — so the login screen must handle both outcomes.

Do **not** show an OTP step to ordinary users. They never get a 202.

### 2.1 The code

- Six digits, valid **10 minutes**, single use.
- **Five wrong guesses burn it.** After that the code is dead and they must sign in again to get a
  new one. Say so in the UI rather than letting them discover it.
- Requesting a new code invalidates the previous one. If you offer a "resend" button, make clear the
  old code stops working.
- Errors are deliberately identical for a wrong code, an expired code and a spent one — all come
  back `401 INVALID_OTP`. Do not try to tell the user which; the API will not tell you, on purpose.

### 2.2 `otp` in the response

Outbound email is **not wired up yet**. While `app.auth.expose-verification-otp` is on, the code
comes back in the 202 body so you can develop against it. It is `null` otherwise, and the flag is
barred from production by a startup guard.

Build the real flow — an input the user types a code into. Reading `otp` straight out of the
response and auto-filling it is fine as a dev convenience, but it must not be the only path, and it
must degrade to the manual input when the field is `null`.

### 2.3 Detecting an operator

After sign-in, `AuthResponse.user.roles` contains `PLATFORM_ADMIN`. That is your gate for showing
the `/platform` area. It arrives per store like every other role (see the storefront guide), but
`PLATFORM_ADMIN` is global — an operator sees it whichever store they signed in at.

**Guard the routes on the role, not on the presence of a token.** Every `/api/v1/platform/**`
endpoint enforces it server-side and returns `403` regardless, so a hidden button is a UX detail
rather than the security boundary — but a console that renders and then 403s on every call is worse
than one that isn't there.

---

## 3. What an operator can do

Everything below is under `/api/v1/platform` and requires `PLATFORM_ADMIN`.

### 3.1 Stores

| | |
|---|---|
| `GET /platform/stores` | Every store on the platform |
| `GET /platform/stores/{id}` | One store |
| `POST /platform/stores` | Create one |
| `PATCH /platform/stores/{id}` | Rename, suspend, close |

`StoreAdminSummaryResponse`:

```json
{
  "id": "…", "slug": "nova", "name": "Nova Sports",
  "status": "ACTIVE",              // ACTIVE | SUSPENDED | CLOSED
  "currency": "INR",
  "codEnabled": true,
  "onlinePaymentConfigured": true, // effective: entitled AND merchant configured it
  "whatsappConfigured": false,
  "onlinePaymentsAllowed": true,   // ── entitlements, §3.2 ──
  "whatsappNotificationsAllowed": true,
  "whatsappCommerceAllowed": false,
  "emailNotificationsAllowed": true,
  "marketingEmailAllowed": false,
  "customDomainAllowed": true,
  "maxStaffSeats": 5,              // null = unlimited
  "createdAt": "…"
}
```

**Note the two families of flag.** `onlinePaymentConfigured` is what is *actually working*;
`onlinePaymentsAllowed` is what the platform *permits*. They differ whenever a merchant has not set
their keys up yet. Show both — an operator debugging "why can't they take payments" needs to see
which half is missing.

**Create:**

```json
POST /platform/stores
{ "slug": "nova", "name": "Nova Sports", "currency": "INR",
  "customDomain": "novasports.in",       // optional
  "adminEmail": "owner@novasports.in",   // optional, but see below
  "adminFullName": "Nova Owner",
  "adminPassword": "…" }                  // required if adminEmail is given
```

Supplying `adminEmail` creates the store's first administrator in the same call. **Encourage it** —
a store with no administrator cannot be signed into, so a store created without one is inert until
someone adds an admin through another route.

Supplying `customDomain` also grants the custom-domain entitlement, since supplying a domain *is*
the operator granting it.

**Status:** `PATCH /platform/stores/{id}` with `{ "status": "SUSPENDED" }`. A suspended or closed
store returns **503 `STORE_UNAVAILABLE`** to every request on its domain. There is deliberately **no
delete** — closing is reversible; erasing a real business's orders and invoices is not.

`slug` cannot be changed after creation. It appears in URLs and may be referenced by DNS.

### 3.2 Entitlements — what a store is allowed to use

```
PATCH /platform/stores/{id}/entitlements
{ "onlinePaymentsAllowed": true,  "whatsappNotificationsAllowed": true,
  "whatsappCommerceAllowed": false, "emailNotificationsAllowed": true,
  "marketingEmailAllowed": false,  "customDomainAllowed": true,
  "maxStaffSeats": 5 }
```

**Every field is applied as given — this is a PUT in PATCH's clothing.** Send the whole object, not
just what changed, or you will silently switch things off. Load the current values into the form
first.

| Field | What it gates |
|---|---|
| `onlinePaymentsAllowed` | Card/UPI. Withdrawn → checkout falls back to COD immediately |
| `whatsappNotificationsAllowed` | Order updates over WhatsApp |
| `whatsappCommerceAllowed` | Browse-and-order **inside** WhatsApp. Needs notifications too |
| `emailNotificationsAllowed` | Order confirmation/shipped/delivered mail |
| `marketingEmailAllowed` | Campaigns and abandoned-cart. Separate from transactional on purpose |
| `customDomainAllowed` | Whether the store may answer on its own hostnames |
| `maxStaffSeats` | Max STAFF/ADMIN members. `null` = unlimited. Never send `0` |

Two behaviours to surface in the UI:

- **Withdrawal is immediate and non-destructive.** Turning off online payments stops it working at
  once, but the merchant's Razorpay keys are kept — re-granting restores their setup. Say this, or
  an operator will hesitate to use the switch.
- **Turning off `customDomainAllowed` detaches every domain the store has.** That is the one
  destructive withdrawal. Warn before saving, and list what will be detached.

### 3.3 Domains

```
GET    /platform/stores/{id}/domains
POST   /platform/stores/{id}/domains              { "hostname": "novasports.in", "makePrimary": true }
PATCH  /platform/stores/{id}/domains/{domainId}/primary
DELETE /platform/stores/{id}/domains/{domainId}
```

```json
{ "id": "…", "hostname": "novasports.in", "primary": true, "createdAt": "…" }
```

A store may hold several hostnames — an apex, its `www` form, a second brand domain — with exactly
one **primary**. The primary is the store's canonical address: order emails, invoices and reset
links all point there.

Rules worth encoding in the UI so the user never hits them as errors:

- The **first** domain a store gets becomes primary automatically, whatever `makePrimary` says.
- The primary **cannot be removed while other domains remain** (`409
  CANNOT_REMOVE_PRIMARY_DOMAIN`). Promote another first. Removing the *last* domain is allowed.
- Requires `customDomainAllowed` (`409 CUSTOM_DOMAIN_NOT_ALLOWED`). Link straight to the
  entitlements form from that error.
- A hostname belongs to one store platform-wide (`409 DOMAIN_TAKEN`). The error deliberately does
  **not** say which store holds it.
- Hostnames are **normalised server-side**: `HTTPS://NovaSports.in/shop ` becomes `novasports.in`.
  You may accept a pasted URL; show the user what was actually stored.

**There is no DNS verification yet.** Attaching a domain is trusted because only an operator can do
it. Nothing checks they control the DNS, and nothing issues a TLS certificate — that is planned
work (`T9` in `multi-store-redesign.md`). Do not imply verification in the UI.

### 3.4 Platform operators

```
GET    /platform/admins
POST   /platform/admins        { "email": "ops@example.com" }
DELETE /platform/admins/{userId}
```

```json
{ "userId": "…", "email": "ops@example.com", "fullName": "Ops", "since": "…" }
```

- **Grants to an account that already exists.** It does not create one. If the person has never
  registered, you get `404 USER_NOT_FOUND` — the UI should say "ask them to sign up first, then
  appoint them", not "user does not exist".
- **Nobody may remove their own access** (`400 CANNOT_REVOKE_OWN_PLATFORM_ADMIN`). Hide or disable
  the button on the current user's own row.
- Only an existing operator can appoint another — a closed set extendable only from within. No store
  admin can reach this however they ask.

This is the most dangerous screen in the console: an appointment hands someone every merchant on the
platform. A confirmation step is warranted.

---

## 4. Conventions

Same as the storefront guide, and worth repeating:

**Errors** are `{ timestamp, status, error, code, message, path, fieldViolations }`. **Branch on
`code`, never on `message`.** Codes you will meet here: `STORE_SLUG_EXISTS`, `STORE_DOMAIN_TAKEN`,
`DOMAIN_TAKEN`, `CUSTOM_DOMAIN_NOT_ALLOWED`, `CANNOT_REMOVE_PRIMARY_DOMAIN`, `USER_NOT_FOUND`,
`CANNOT_REVOKE_OWN_PLATFORM_ADMIN`, `ADMIN_PASSWORD_REQUIRED`, `INVALID_OTP`.

**Auth** is `Authorization: Bearer <accessToken>`. Access tokens last ~15 minutes; refresh via
`POST /auth/refresh` and keep **exactly one refresh in flight** — refresh tokens rotate and reusing
a spent one revokes the whole session.

**Pagination** is Spring's page object: `?page=0&size=20&sort=createdAt,desc` in, `{ content,
totalElements, totalPages, number, size, first, last }` out. The platform store list is *not*
paginated; it returns a plain array.

**Money** is decimal strings. **Timestamps** are ISO-8601 UTC.

---

## 5. Where this console lives

It is a route tree inside an existing storefront, not a separate app. Two consequences:

**The API is reached the same way the storefront reaches it** — relative paths through the same
origin, with `/api/*` proxied to the backend from the store's own domain. Do not introduce a
separate API base URL for the platform screens. (Storefront guide §1.2 explains why: the backend
picks the store from the `Host`, so calling a shared API hostname directly resolves the wrong
store.)

**An operator is signed in "at" whichever store they used.** Their token works everywhere, so the
platform screens function regardless — but anything on the page that reads store context (the
storefront header, the current store's name) will show *that* store. Keep the platform area visually
distinct so an operator never mistakes it for the store's own admin.

---

## 6. Suggested screens

Scope agreed for v1: stores list, store detail with entitlements, domains. Operators management is
listed because the API exists; treat it as optional.

```
/platform
  ├─ Stores            list · status chip · "New store"
  ├─ Stores/:id        name, status, currency, seats
  │    ├─ Entitlements  the seven switches (§3.2) — load current values first
  │    └─ Domains       list · add · make primary · remove
  └─ Operators          list · appoint · revoke        (optional)
```

## 7. Checklist

- [ ] Login handles **both** 200 and 202; the OTP step appears only on 202.
- [ ] OTP input is a real input, working when `otp` is `null` in the response.
- [ ] "Code expires in 10 minutes"; five wrong tries means starting over.
- [ ] `/platform` routes guarded on `PLATFORM_ADMIN` in `user.roles`.
- [ ] Entitlements form loads current values and submits **all** fields.
- [ ] Turning off `customDomainAllowed` warns that domains will be detached.
- [ ] Domain errors link to the entitlements form where relevant.
- [ ] "Revoke" hidden on the current operator's own row.
- [ ] Creating a store nudges toward supplying an admin email.
- [ ] Platform area is visually distinct from the store's own admin.
- [ ] No claim anywhere that domains are DNS-verified.

## 8. Status

Written 2026-08-09. Everything described is implemented and unit-tested, but **has not been
exercised against a running database** — the migrations through V26 have never been executed. If the
API behaves differently from this document, trust the running server and `/swagger-ui`, and report
the discrepancy rather than working around it.
