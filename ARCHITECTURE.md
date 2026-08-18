# Amanly Frontend — Architecture & Foundation Contract

React 18 + TypeScript + Vite + Tailwind + React Router v6 + TanStack Query.
SPA served by Vite in dev (proxy `/api` → :8080, so requests stay same-origin). In production
`npm run build` emits a static `dist/` that Caddy serves as its own Railway service, **proxying
`/api/*` to the backend from the shop's own domain** (`API_UPSTREAM`). That proxy is load-bearing:
one backend serves many shops and picks which one from the `Host` header, so calling the API's own
origin from the browser would resolve every request to the fallback store. `VITE_API_BASE_URL`
survives only as an escape hatch for clients that cannot proxy. See `README.md` and
`docs/storefront-api-guide.md` §1.2.

**This app is Amanly's storefront + admin, plus the platform console** (`/platform`,
`PLATFORM_ADMIN` only) for managing the other shops on the platform — see
`docs/platform-console-guide.md`.

## Golden rules for building pages

- Every page is a **default-exported** component in `src/pages/...`.
- Import ONLY from the modules listed below. Do NOT invent endpoints, fields, or exports.
- Use the shared UI kit (`@/components/ui`) — do not hand-roll buttons/inputs/cards.
- Data fetching: **TanStack Query** (`useQuery`/`useMutation`), `queryClient.invalidateQueries`.
- Errors: `catch (e) { if (e instanceof ApiError) ... }`. For forms use `e.fieldErrorMap()`
  (record keyed by field name); otherwise `toast.error('Title', e.message)`.
- Money: `money(amount, currency)`. Dates: `formatDate` / `formatDateTime` / `timeAgo`.
- Theme: **light and dark, both live.** Always use the role tokens — `text-slate-*` (text),
  `bg-ink-*` (surfaces), `border-ink-*`, `bg-primary`/`text-primary-fg` (actions),
  `bg-banner`/`bg-band` (full-bleed ink areas). Never hard-code a colour or reach for a stock
  Tailwind shade: the scale *names* are legacy, but every step resolves through a CSS variable
  that flips with the palette, and a literal `bg-white`/`slate-900` silently will not.
  - `ThemeProvider` (`@/context/ThemeContext`) is the **only** writer of the `dark` class on
    `<html>`. Read state with `useTheme()`; never touch `classList` yourself.
  - The storefront follows the shopper's choice (light / dark / system, persisted under
    `rc_theme`, with a no-flash bootstrap inline in `index.html`).
  - The consoles hold dark regardless, by calling `useDarkTheme()` — which registers a claim
    with the provider rather than setting the class, so leaving `/admin` cannot wipe a
    shopper's preference. They also get `.theme-console`, which restores the gold primary and
    the ambient gold wash; the storefront in dark gets neither.
- Icons: `lucide-react`.

## Exact module exports (source of truth)

### `@/lib/types` — types & enums
Enums (string unions): `RoleName` = 'CUSTOMER'|'STAFF'|'ADMIN'|'PLATFORM_ADMIN' (the last is GLOBAL — the same account holds it at every store — and is never grantable through the admin user API); `UserStatus` = 'ACTIVE'|'LOCKED'|'DISABLED';
`AuthProvider` = 'LOCAL'|'GOOGLE'; `ProductStatus` = 'DRAFT'|'ACTIVE'|'ARCHIVED';
`OrderStatus` = 'PENDING'|'PROCESSING'|'SHIPPED'|'DELIVERED'|'CANCELLED';
`OrderPaymentStatus` = 'PENDING'|'PAID'|'FAILED'|'PARTIALLY_REFUNDED'|'REFUNDED'; `PaymentMethod` = 'CASH'|'UPI'|'RAZORPAY';
`StoreStatus` = 'ACTIVE'|'SUSPENDED'|'CLOSED' (a SUSPENDED/CLOSED store answers 503 `STORE_UNAVAILABLE` on its domain).
Interfaces: `Page<T>` {content:T[], totalElements, totalPages, number(0-based), size, first, last, numberOfElements, empty};
`UserResponse` {id,email,fullName,provider,status,roles:RoleName[],emailVerifiedAt,createdAt,updatedAt};
`AuthResponse` {tokenType,accessToken,expiresInSeconds,refreshToken,user};
`CategoryResponse` {id,name,slug,description,parentId,parentName,depth,sortOrder,active,createdAt,updatedAt};
`CategoryTreeResponse` {id,name,slug,sortOrder,children[]};
`ProductImageResponse` {id,url,altText,sortOrder,isPrimary};
`ProductResponse` {id,name,slug,description,shortDescription,sku,price,compareAtPrice,currency,status,categoryId,categoryName,categorySlug,`brandId`?:string|null,`brandName`?:string|null,weight,sellingUnit,stockQuantity,tags:string[],images[],`variants`?:ProductVariantResponse[],`ratingAvg`:number|null,`ratingCount`:number,createdAt,updatedAt};
`ProductSummaryResponse` {id,name,slug,sku,price,compareAtPrice,currency,status,categoryName,`brandId`?:string|null,`brandName`?:string|null,primaryImageUrl,stockQuantity,`ratingAvg`:number|null,`ratingCount`:number,`hasVariants`?:boolean};
  `hasVariants` — true when the product has ≥1 ACTIVE variant, i.e. it CANNOT be added to the bag from a listing (the backend answers `400 VARIANT_REQUIRED`); send the shopper to the PDP to choose. Optional so cached summaries (localStorage recently-viewed) still type-check; absent reads as false. Batched server-side (one query per page), not per row.
  (WP-3.5: `brandId`/`brandName`/`variants` are additive & nullable — typed OPTIONAL so pre-3.5 cached payloads still compile; backend always populates them. `variants` is `[]` for a variantless product; a product with ≥1 ACTIVE variant is variant-based — a `variantId` is then REQUIRED to add it to the cart.)
  (WP-3.2b: `ratingAvg`/`ratingCount` are the APPROVED-review aggregate. Typed OPTIONAL in TS so pre-3.2 cached payloads — e.g. localStorage recently-viewed summaries — still compile; backend always populates them. Treat `ratingAvg==null` / `ratingCount==0` as "no ratings" and render nothing, never "0 (0)".)
`ProductImageRequest` {url,altText?,sortOrder,isPrimary};
`CreateProductRequest` {name,slug,sku,price,compareAtPrice?,currency,categoryId?,`brandId`?,description?,shortDescription?,weight?,tags?,images?,stockQuantity?};
`UpdateProductRequest` {name,description?,shortDescription?,price,compareAtPrice?,currency,categoryId?,`brandId`?(send null to clear),weight?,tags?,stockQuantity?} (NO slug/sku/images);
`ProductSearchParams` {categoryId?,`brandId`?,minPrice?,maxPrice?,search?,tag?,status?,page?,size?,sort?} (brandId composes with the rest, WP-3.5);
Brands & variants (WP-3.5): `BrandResponse` {id,name,slug,description:string|null,logoUrl:string|null,active,createdAt,updatedAt};
  `CreateBrandRequest` {name,slug,description?,logoUrl?,active?}; `UpdateBrandRequest` {name,slug,description?,logoUrl?,active(REQUIRED)} (409 `BRAND_SLUG_EXISTS`).
  `ProductVariantResponse` {id,sku,options:Record<string,string>,optionsLabel:string,priceOverride:number|null,effectivePrice:number,stockQuantity,imageId:string|null,active};
  `CreateVariantRequest` {sku,options(non-empty),price?,stockQuantity?,imageId?,active?}; `UpdateVariantRequest` {options,price?,imageId?,active(REQUIRED)} (SKU immutable; stock via a dedicated endpoint; 409 `VARIANT_SKU_EXISTS`/`VARIANT_OPTIONS_EXISTS`).
`CreateCategoryRequest` {name,slug,description?,parentId?}; `UpdateCategoryRequest` {name,description?,sortOrder?,active?};
`CartItemResponse` {cartItemId,productId,productName,productSlug,sku,`variantId`?:string|null,`variantSku`?:string|null,`variantOptionsLabel`?:string|null,quantity,unitPrice,subtotal,reservationRemainingMinutes} (WP-3.5 variant fields null for a variantless line);
`CartResponse` {cartId,userId,items[],totalAmount,currency};
`ShippingDetails`/`ShippingAddressRequest` {name,phone?,addressLine1,addressLine2?,city,state?,postalCode,country};
`OrderItemResponse` {id,productId,productName,sku,`variantId`?:string|null,`variantSku`?:string|null,`variantOptions`?:string|null,unitPrice,quantity,subtotal} (WP-3.5 variant snapshot null for a variantless line);
`PaymentAction` {provider,razorpayKeyId,razorpayOrderId,amountMinor,currency};
`OrderResponse` {id,`orderNumber`?:string|null,userId,status,paymentMethod,paymentStatus,`totalAmount`(payable),`subtotalAmount`(WP-P.6),`discountAmount`:number(0 when none, WP-3.4),`shippingAmount`(WP-P.6),`taxAmount`(WP-P.6),`taxRatePercent`(WP-P.6),`taxInclusive`:boolean(WP-P.6),`couponCode`:string|null(WP-3.4),currency,shippingAddress,notes,items[],paymentAction,createdAt,updatedAt};
  - **Money breakdown (WP-P.6).** All figures are placement-time snapshots — editing store settings never changes a placed order. The relationship depends on `taxInclusive`:
    `taxInclusive=false` → `total = subtotal - discount + shipping + tax` (tax added on top);
    `taxInclusive=true` → `total = subtotal - discount + shipping` (`taxAmount` is the portion already inside `total` — **do not add it again** when rendering).
    `OrderSummaryResponse` is unchanged and still carries only `totalAmount`; that figure is now complete, so list rows need no adjustment.
`OrderSummaryResponse` {id,status,paymentMethod,totalAmount,currency,itemCount,shippingCity,shippingCountry,createdAt} (order LIST — NO discount fields);
`PlaceOrderRequest` {shippingAddress,notes?,paymentMethod?,`couponCode`?(WP-3.4 — re-validated at placement; an invalid code REJECTS the order, never silently dropped)};
`RazorpayVerifyRequest` {orderId,razorpayPaymentId,razorpayOrderId,razorpaySignature};
`PublicStoreResponse` {`slug`,name,currency,codEnabled,onlinePaymentEnabled,`shippingFlatAmount`(WP-P.6),`freeShippingThreshold`:number|null(WP-P.6, null = never free),`taxRatePercent`(WP-P.6),`pricesIncludeTax`:boolean(WP-P.6)};
  - Enough to render delivery cost and "free delivery over X" messaging before checkout, and to label prices "incl. tax" vs "+ tax at checkout". **There is no cart totals-preview endpoint yet** — the storefront must apply the same rules client-side (discounted subtotal ≥ threshold → free; tax on goods + shipping), and the placed `OrderResponse` remains authoritative.
`StoreSettingsResponse` {id,slug,name,currency,status,codEnabled,onlinePaymentEnabled,razorpayKeyId,razorpayConfigured,whatsappEnabled};
`UpdatePaymentSettingsRequest` {codEnabled,onlinePaymentEnabled,razorpayKeyId?,razorpayKeySecret?,razorpayWebhookSecret?};
`UpdateWhatsappSettingsRequest` {enabled,phoneNumberId?,accessToken?,verifyToken?,appSecret?};
`AdminCreateUserRequest` {email,fullName,password,roles}; `ChangeUserRolesRequest` {roles};
`SavedAddress` extends ShippingDetails {id,label,isDefault}.
Reviews (WP-3.2b): `ReviewStatus`='PENDING'|'APPROVED'|'REJECTED';
`ReviewResponse` {id,rating:number,title:string|null,body:string|null,reviewerName,verifiedPurchase:boolean,createdAt} (public, APPROVED only);
`ReviewSummaryResponse` {average:number|null,count:number,buckets:Record<'1'..'5',number>};
`MyReview` {id,rating,title,body,status:ReviewStatus,verifiedPurchase,createdAt,updatedAt};
`MyReviewResponse` {purchased:boolean,canReview:boolean,review:MyReview|null} (canReview===purchased&&review==null);
`CreateReviewRequest`/`UpdateReviewRequest` {rating:1..5,title?,body?} (title≤150, body≤4000);
`AdminReviewResponse` {id,productId,userId,reviewerName,rating,title,body,status,verifiedPurchase,createdAt,updatedAt}.
Wishlist (WP-3.3): `WishlistMutationResponse` {productId:string, wishlisted:boolean, wishlistCount:number} — the
  result of an idempotent add/remove (`wishlisted` = resulting state, `wishlistCount` = new total). The wishlist
  itself is read as `ProductSummaryResponse[]` (full list, most-recent first) or `string[]` (product ids for hearts).
Coupons (WP-3.4): `CouponType`='PERCENT'|'FIXED'; `CouponRejectionReason`='NOT_FOUND'|'INACTIVE'|'NOT_STARTED'|
  'EXPIRED'|'MIN_ORDER_NOT_MET'|'MAX_REDEMPTIONS_REACHED'|'PER_USER_LIMIT_REACHED';
  `CouponValidationRequest` {code, subtotal?} (subtotal is an advisory fallback — server prefers the live cart);
  `CouponPreviewResponse` {valid:boolean, code, reason:CouponRejectionReason|null, message, subtotal,
    discountAmount:number|null, total:number|null} — ADVISORY, ALWAYS HTTP 200 (read `valid`; the authoritative
    discount is on the placed `OrderResponse.discountAmount`). `message` is display-ready per reason.
  `AdminCouponResponse` {id,code,type,value,minOrderAmount,startsAt,endsAt,maxRedemptions,perUserLimit,active,
    totalRedemptions,createdAt,updatedAt};
  `CreateCouponRequest` {code,type,value,minOrderAmount?,startsAt?,endsAt?,maxRedemptions?,perUserLimit?,active?}
    (active defaults true); `UpdateCouponRequest` (same, but `active` REQUIRED — full replace).
Stats (WP-3.1a): `StatsMoneyMetric`/`StatsCountMetric` {current,previous,changePct(number|null)};
`StatsOverviewResponse` {from,to,revenue:MoneyMetric,paidOrders:CountMetric,totalOrders,customers,averageOrderValue:MoneyMetric,ordersByStatus:Record<OrderStatus,number>(all 5, zero-filled)};
`RevenueGranularity`='day'|'week'|'month'; `RevenueSeriesPoint` {periodStart,revenue,orderCount};
`RevenueSeriesResponse` {from,to,granularity,points[]} (contiguous/zero-filled — plot as-is);
`TopProductStat` {productId,name,slug(null if deleted),unitsSold,revenue};
`LowStockProduct` {productId,name,slug,sku,stockQuantity,status:ProductStatus}.

### `@/lib/http`
`TokenStore` {save,getAccessToken,getRefreshToken,getUser,setUser,isExpired,isAuthenticated,clear};
`class ApiError` {status:number, code:string, message:string, fieldViolations[], hasFieldErrors(), fieldErrorMap():Record<string,string>};
`request<T>(method,url,{body,auth,retry,signal})`, `requestWithStatus<T>(...)`:`{status,data}` (only for
endpoints where two success codes mean different things — `POST /auth/login` answers 200 *or* 202),
`buildQuery(params)`. (Pages rarely call these directly — use api modules.)

### `@/lib/format`
`money(amount,currency='USD')`, `formatDate(iso)`, `formatDateTime(iso)`, `titleCase(s)`, `timeAgo(iso)`.

### `@/lib/addressBook` — `addressBook` {list(), getDefault(), add(label,details,makeDefault), update(id,label,details,makeDefault), remove(id), setDefault(id)}
### `@/lib/razorpay` — `loadRazorpay(): Promise<void>`

### API modules
`@/api/auth`: login(email,password), register(email,fullName,password), logout(), forgotPassword(email), resetPassword(token,newPassword), resendEmailVerification(email), verifyEmail(token).
`@/api/users`: getCurrentUser(), updateProfile(fullName), updatePassword(currentPassword,newPassword).
`@/api/catalog`: listProducts(params):Page<ProductSummaryResponse>, getProduct(slug):ProductResponse, listCategories():CategoryResponse[], getCategoryTree():CategoryTreeResponse[], getCategory(slug), getTopProducts({categoryId?,limit?}):ProductSummaryResponse[] (PUBLIC best-sellers, WP-3.1a — `[]` until something sells; powers the Home best-sellers rail. CAVEAT: does NOT compose with PLP filters/pagination), `listBrands`():BrandResponse[] (PUBLIC active brands, WP-3.5 — powers the PLP brand facet).
`@/api/cart`: getCart(), `addToCart(productId,quantity,variantId?)`, `updateCartItem(productId,quantity,variantId?)`, `removeCartItem(productId,variantId?)`, clearCart(). (WP-3.5: `variantId` is optional & backward-compatible — omit it for a variantless product/line, pass it for a variant. Update/remove append `?variantId=…`; add includes it in the body. All existing variantless callers keep working unchanged.)
`@/api/orders`: placeOrder(body):OrderResponse, listOrders({page,size,sort}):Page<OrderSummaryResponse>, getOrder(id):OrderResponse, cancelOrder(id):OrderResponse, verifyRazorpayPayment(body):OrderResponse.
`@/api/store`: getPublicStore():PublicStoreResponse.
`@/api/coupons` (WP-3.4): validateCoupon(code, subtotal?):CouponPreviewResponse (auth; POST /coupons/validate —
  ALWAYS resolves 200, read `valid` rather than catching). Advisory preview for the cart/checkout; the real discount
  is recomputed at placement. The Cart page persists the applied code via `@/lib/couponStorage`
  (localStorage `rc-applied-coupon`) so Checkout carries it into `placeOrder`.
`@/api/reviews` (WP-3.2b): listReviews(productId,{page?,size?,sort?}):Page<ReviewResponse> (public, APPROVED only),
  getReviewSummary(productId):ReviewSummaryResponse (public), getMyReview(productId):MyReviewResponse (auth),
  createReview(productId,body):MyReview (auth; 403 REVIEW_NOT_PURCHASED / 409 REVIEW_ALREADY_EXISTS),
  updateMyReview(productId,body):MyReview (auth; resets review to PENDING). NOTE: routes are scoped by product
  **UUID** (`/api/v1/products/{productId}/reviews`), not slug — pass `product.id`.
`@/api/wishlist` (WP-3.3b, all auth-required under `/api/v1/users/me/wishlist`, 401 if logged out):
  getWishlist():ProductSummaryResponse[] (most-recent first), getWishlistIds():string[] (ids for heart state),
  addToWishlist(productId):WishlistMutationResponse (idempotent; 404 if product missing),
  removeFromWishlist(productId):WishlistMutationResponse (idempotent). Pages consume these via `WishlistContext`,
  not directly (except Cart's save-for-later, which calls `addToWishlist` then `removeCartItem`).
`@/api/admin`:
  `adminProducts`.{list(params):Page<ProductSummaryResponse>, get(id), create(body), update(id,body), changeStatus(id,status), setStock(id,quantity), addImages(id,images[]), deleteImage(id,imageId), remove(id)};
  `adminProductVariants` (WP-3.5, STAFF+ADMIN; scoped under a product).{list(productId):ProductVariantResponse[], create(productId,body):ProductVariantResponse, update(productId,variantId,body) (SKU immutable), setStock(productId,variantId,quantity):ProductVariantResponse, remove(productId,variantId):void};
  `adminBrands` (WP-3.5, STAFF+ADMIN; NO delete — deactivate only).{list():BrandResponse[], get(id), create(body):BrandResponse, update(id,body):BrandResponse, deactivate(id):BrandResponse} (409 `BRAND_SLUG_EXISTS`);
  `adminCategories`.{list():CategoryResponse[], create(body), update(id,body), remove(id),
  move(id,MoveCategoryRequest)};
  - **`move` re-parents a category AND its whole subtree.** `parentId: null` promotes to the top
    level; `sortOrder` rides along so a drag is one call. Never offer a destination inside the branch
    being moved — `400 CATEGORY_CYCLE` — and note `400 CATEGORY_DEPTH_EXCEEDED` weighs the branch's
    DEEPEST leaf, not the row being dragged.
  `adminOrders`.{list({page,size,sort}):Page<OrderSummaryResponse>, get(id), updateStatus(id,status)};
  `adminUsers`.{list({search,page,size,sort}):Page<UserResponse>, get(id), create(body), changeRoles(id,roles), lock(id,reason?), unlock(id), disable(id,reason?)};
  `adminStore`.{get():StoreSettingsResponse, updatePayment(body), updateWhatsapp(body), **updateCommerce(body)**(WP-P.6, `PUT /api/v1/admin/store/commerce-settings`, ADMIN)};
  - `StoreSettingsResponse` gains `shippingFlatAmount`,`freeShippingThreshold`,`taxRatePercent`,`pricesIncludeTax` (WP-P.6).
  - `updateCommerce` body = `{shippingFlatAmount, freeShippingThreshold|null, taxRatePercent, pricesIncludeTax}`. Unlike `updatePayment`, there is **no "null = keep existing"** rule — send the complete policy every time; `freeShippingThreshold: null` genuinely means "never free". Applies to future orders only.
  `adminReviews` (WP-3.2b, STAFF+ADMIN).{list({status?,page?,size?}):Page<AdminReviewResponse>, approve(id):AdminReviewResponse,
    reject(id):AdminReviewResponse} (approve/reject 400 INVALID_REVIEW_STATUS_TRANSITION);
  `adminCoupons` (WP-3.4, STAFF+ADMIN; delete ADMIN-only).{list({page?,size?,sort?}):Page<AdminCouponResponse>, get(id),
    create(body):AdminCouponResponse, update(id,body):AdminCouponResponse, deactivate(id):AdminCouponResponse,
    remove(id):void} — `remove` is ADMIN-only and 409 `COUPON_HAS_REDEMPTIONS` on a used coupon (deactivate instead).
`@/api/stats` (STAFF+ADMIN, `auth:true`; WP-3.1a). `adminStats`.{
  `overview({from?,to?})`:StatsOverviewResponse, `revenueSeries({from?,to?,granularity?})`:RevenueSeriesResponse,
  `topProducts({from?,to?,limit?})`:TopProductStat[], `lowStock({threshold?,limit?})`:LowStockProduct[]}.
  Dates are `yyyy-MM-dd`, inclusive; both optional (default trailing 30 days). Money is exact BigDecimal in the
  store currency (no currency field on the DTOs — use `getPublicStore().currency`); `changePct` is null when the
  previous period was 0 (render "—", never 0). `Dashboard.tsx` / `Reports.tsx` are built on these.

### `@/api/platform` — platform surface (PLATFORM_ADMIN)
`platformStores`.{list():StoreAdminSummaryResponse[] (NOT paginated), get(storeId), create(CreateStoreRequest),
update(storeId,UpdateStoreRequest), updateEntitlements(storeId,UpdateStoreEntitlementsRequest)};
`platformDomains`.{list(storeId), add(storeId,AddStoreDomainRequest), rename(storeId,domainId,UpdateStoreDomainRequest),
makePrimary(storeId,domainId), remove(storeId,domainId)};
`platformAdmins`.{list(), grant(GrantPlatformAdminRequest), revoke(userId)}.
  - **Entitlements are applied as sent** — load current values and submit the whole object, or omitted
    fields are switched off. Turning off `customDomainAllowed` DETACHES every domain (the only
    destructive withdrawal; warn first). Codes: `STORE_SLUG_EXISTS`, `DOMAIN_TAKEN`,
    `CUSTOM_DOMAIN_NOT_ALLOWED`, `CANNOT_REMOVE_PRIMARY_DOMAIN`, `USER_NOT_FOUND`,
    `CANNOT_REVOKE_OWN_PLATFORM_ADMIN`, `ADMIN_PASSWORD_REQUIRED`, `INVALID_OTP`.
  - Domains are trusted, not DNS-verified, and no certificate is issued — never imply otherwise in UI.
  - **`CreateStoreRequest.customDomain` is REQUIRED (2026-08-16)** — omitting it is a 400. A request is
    routed to a store by the address it carries, so a store created without one is unreachable and
    everything meant for it is answered by the fallback store. It is attached as the primary and grants
    the custom-domain entitlement, so the follow-up attach form cannot then hit
    `CUSTOM_DOMAIN_NOT_ALLOWED`. `DOMAIN_TAKEN` on create means NO store was made.
  - **Addresses may carry a port and may be single-label** — `http://localhost:5180/` stores as
    `localhost:5180`, which is how a store is pointed at a UI with no domain yet. Addresses are matched
    WHOLE: `amanly.in` and `tech.amanly.in` are unrelated and may belong to different stores; there is no
    subdomain or slug-based resolution any more. `rename` re-points a mapping keeping its id and primary
    flag — prefer it to remove-then-add, which is refused for the primary while others remain.

### `@/api/productBulk` — bulk catalogue upload/download (WP-4.1a)
`productBulk`.{import(file,dryRun):202+jobId, status(jobId), history(params), exportCsv(filters)}.
  - Rows key on **SKU**: existing → update, new → create as DRAFT. On an update a **blank cell leaves
    that field unchanged** — importing can never clear a field. Say so in any UI.
  - Import is **ADMIN only**; export is STAFF+. Applied in the background, so poll `status` until
    `COMPLETED` or `FAILED`. **`COMPLETED` ≠ every row worked** — it means the file was read to the end;
    read `failedCount`. `FAILED` means the file itself was unusable (`failureMessage`).
  - `issue.line` is the SPREADSHEET row (header = 1), not an array index. Codes: `IMPORT_ALREADY_RUNNING`
    (one import per store at a time — disable the control), `IMPORT_FILE_TOO_LARGE`, `IMPORT_FILE_NOT_UTF8`.
  - `exportCsv` bypasses `request`: the response is CSV, and a bare `<a href>` cannot carry the bearer
    token, so it fetches and hands the browser an object URL. Export writes the columns the importer
    reads — that round trip is the whole feature.

### `@/lib/totals` — money breakdown (WP-P.6)
`orderTotals(order):MoneyBreakdown` (reads a PLACED order; `totalAmount` passes through untouched,
`hasShipping` false for pre-WP-P.6 payloads so "unknown" is never rendered as "Free");
`estimateCartTotals(subtotal,discount,store):MoneyBreakdown|null` (pre-placement ESTIMATE — null when the
store published no rules); `amountToFreeShipping(discountedSubtotal,store)`; `taxLabel(store)`.
Render placed orders with `@/components/OrderTotals`; never recompute a placed order's figures.

### Contexts
`@/context/AuthContext` → `useAuth()`: {user, isAuthenticated, isStaff, isAdmin, `isPlatformAdmin`, `showsPlatformConsole`, `signedInVia`, loading, `login(email,pw,via?)`, `verifyLoginOtp(email,code,via?)`, register(email,name,pw), logout(), refreshUser(), setUser(u)}.
  - `login` is TWO-ARMED: `{kind:'session'}` or `{kind:'otpRequired'}` (a 202 for a platform operator — nobody is signed in until `verifyLoginOtp`).
  - **`isPlatformAdmin` vs `showsPlatformConsole`.** An operator is granted STAFF and ADMIN inside *every* store, so role alone cannot say whether to offer the platform console — `isStaff` matches them too. `via` records the door (`'store'` from /login and /register, `'platform'` from /admin/login), and `showsPlatformConsole` is role AND platform context. Guard routes on the role (`RequirePlatformAdmin`); decide what to OFFER with `showsPlatformConsole`. Persisted next to the tokens and cleared on logout; a token refresh never changes it.
`@/context/ThemeContext` → `useTheme()`: {preference:'light'|'dark'|'system', setPreference(p), resolved:'light'|'dark', forcedByConsole, acquireForcedDark()}.
  - **Sole owner of the `dark` class on `<html>`.** Console layouts call `useDarkTheme()` (`@/lib/useDarkTheme`), which registers a claim instead of writing the class — the previous add-on-mount/remove-on-unmount version silently reverted a shopper's dark choice on the way out of `/admin`. Claims are counted, so nested console layouts each release independently.
  - `resolved` is what is on screen after the OS and any console claim; `preference` is what the shopper asked for. Render pickers off `preference`, colours off tokens.
`@/context/CartContext` → `useCart()`: {cart, itemCount, loading, refresh(), setCart(c), lineFor(productId), addProduct(productId,qty,name), setProductQuantity(productId,qty,name)}. Call `refresh()` after cart mutations made outside the context.
  `addProduct`/`setProductQuantity` own the whole interaction — they write the returned cart into state, toast success/failure, and `addProduct` is **auth-gated** (redirects to `/login` preserving `from`), mirroring `useWishlist().toggle`. `setProductQuantity(id, 0, name)` removes the line. Both are **variantless-line only**; a variant product is bought from its PDP. `useCart()` does **not** throw outside a provider (returns an inert value) so leaf components carrying bag controls still render in isolated tests.
`@/context/WishlistContext` → `useWishlist()`: {ids:Set<string>, count, ready, isWishlisted(id), toggle(id), refresh()}
  (WP-3.3b). Loads wishlisted ids once for authenticated users (skips all network calls when logged out); `toggle`
  is **optimistic** (heart flips immediately, rolls back + toasts on API error) and **auth-gated** (redirects to
  `/login` with `from` when logged out). Mounted under `AuthProvider`+`CartProvider` (needs `useAuth`/`useToast`/
  router). Unlike the other context hooks it does **not** throw without a provider — it returns an inert default so
  low-level `ProductCard` can render an outline heart in isolated tests; the real provider is always mounted (main.tsx).
`@/context/ToastContext` → `useToast()`: {success(t,m?), error(t,m?), info(t,m?), warning(t,m?), push(kind,t,m?)}.

### UI kit `@/components/ui`
Split into a `src/components/ui/` directory (one file per component) behind a barrel — import from `@/components/ui`
only, never a deep path. Built entirely on the role tokens, so every component renders correctly in **both**
palettes — light and dark are both live (see Theme above); every interactive element is
keyboard-operable with the standard gold focus ring. Radix-backed components (marked ⚛) provide focus-trap/ARIA.
A dev-only `/dev/kitchen-sink` route renders all of them in every variant (mounted only when `import.meta.env.DEV`;
tree-shaken out of production).

**Core primitives (unchanged surface):**
`cn(...)`; `Button` {variant:'primary'|'secondary'|'ghost'|'danger'|'outline', size:'sm'|'md'|'lg', loading, fullWidth, ...button attrs}
(also exports `ButtonVariant`/`ButtonSize` types + `BUTTON_VARIANTS`/`BUTTON_SIZES`);
`LinkButton` {to, variant, size, fullWidth, children}; `Field` {label?, error?, hint?, required?, className?, children};
`Input`/`Textarea`/`Select` (accept `invalid?` + native attrs, className `rc-input` applied);
`PasswordInput` (like `Input`, owns its `type`, adds a show/hide toggle); `Card` {className?, children};
`Badge` {tone:'gold'|'green'|'red'|'blue'|'gray'|'amber'|'purple', children} (`Tone` type exported; now uses semantic
success/warning/danger/info tokens — zero visual change); `Spinner`, `PageLoader`;
`EmptyState` {icon?, title, message?, action?}; `Modal` {open, onClose, title, children, footer?, size?:'sm'|'md'|'lg'|'xl'}
(legacy hand-rolled dialog, kept as-is); `Pagination` {page(0-based), totalPages, onChange(page)};
`PageHeader` {title, subtitle?, action?}.

**WP-1.2 additions:**
- `Skeleton` {className?} + `SkeletonText` {lines?}, `SkeletonCard`, `SkeletonTable` {rows?, columns?}, `SkeletonDetail` — loading placeholders.
- ⚛ `Tabs` {value?/defaultValue?, onValueChange?} + `TabsList`, `TabsTrigger` {value}, `TabsContent` {value}.
- ⚛ `DropdownMenu` {trigger, align?, sideOffset?} + `DropdownMenuItem` {onSelect?, destructive?}, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuCheckboxItem` {checked?, onCheckedChange?}.
- ⚛ `Tooltip` {content, side?, sideOffset?} wrapping a focusable child; `TooltipProvider` {delayDuration?} for app-wide sharing.
- ⚛ `Drawer` {open?, onOpenChange?, side?:'left'|'right'|'top'|'bottom', title?, description?, footer?} (off-canvas Sheet; used by WP-1.3 mini-cart/mobile-nav) + `DrawerTrigger`, `DrawerClose`, `DrawerSide` type.
- ⚛ `Accordion` {type?:'single'|'multiple', collapsible?, value?/defaultValue?, onValueChange?} + `AccordionItem` {value, title}.
- `Breadcrumbs` {items:Crumb[]} where `Crumb` {label, to?} (omit `to` on the current/last crumb).
- `Stepper` {steps:Step[], current(0-based)} where `Step` {label, description?} — display-only progress.
- `DataTable<T>` {columns:Column<T>[], data, getRowKey, loading?, loadingRows?, empty?, onRowClick?, rowActions?, stickyHeader?, defaultSort?, sort?/onSortChange? (controlled), containerClassName?}; `Column<T>` {key, header, render?, sortable?, sortAccessor?, align?, className?, headerClassName?}; `SortState`/`SortDir` exported. Sorts internally unless `sort`+`onSortChange` given.
- ⚛ `ConfirmDialog` {open?, onOpenChange?, trigger?, title, description?, confirmLabel?, cancelLabel?, destructive?, loading?, onConfirm} — AlertDialog; stays open during async, caller closes via onOpenChange.
- `QuantityStepper` {value, onChange, min?, max?, step?, disabled?, size?} — clamped −/＋ numeric control.
- `PriceTag` {price, compareAtPrice?, currency?, size?, showDiscountBadge?} — shows compare-at + computed discount % only when compareAt > price.
- `RatingStars` {value, max?, size?, count?} — display-only. `RatingInput` {value, onChange, max?, size?, name?, label?, disabled?} — WP-3.2b interactive rating (native radio-per-star, `radiogroup`/`radio` semantics, arrow-key operable, gold focus ring on the focused star). Two separate exports so the display-only surface is unchanged.
- `ImageWithFallback` {src?, alt, wrapperClassName?, fallback?, ...img attrs} — graceful placeholder on missing/broken src; lazy by default.
- `Carousel` {children(slides), loop?, showDots?, showArrows?, ariaLabel?} — one-per-view, arrow-key navigable.
- `SearchInput` {defaultValue?, onSearch, delay?(300), placeholder?} — debounced, with clear button.
- `FilterChip` {children, selected?, onClick?, onRemove?} — toggle and/or removable filter pill.
- `Stat` {label, value, icon?, delta?:StatDelta, hint?} where `StatDelta` {value, suffix?, positiveIsGood?, label?} — dashboard KPI tile with trend (successor to `admin/StatCard`).
- `ThemedAreaChart`/`ThemedLineChart`/`ThemedBarChart` {data, xKey, series:ChartSeries[], height?, showGrid?, showLegend?, xTickFormatter?, yTickFormatter?, valueFormatter?} — recharts wrappers themed from tokens; `chartTheme` styles + `CHART_COLORS` palette also exported for bespoke charts.

New deps: `@radix-ui/react-{tabs,dropdown-menu,tooltip,dialog,accordion,alert-dialog}` (headless a11y primitives).

### `@/components/StatusBadge`
`OrderStatusBadge`, `PaymentStatusBadge`, `ProductStatusBadge`, `UserStatusBadge` — each takes `{status}`.

### `@/components/guards`
`RequireAuth`, `RequireStaff` (STAFF|ADMIN), `RequireAdmin`, `RequirePlatformAdmin` (PLATFORM_ADMIN —
the platform console; an operator need not be a member of the current store) — used as route elements
wrapping `<Outlet/>`.

### `@/components/WishlistButton` (WP-3.3b)
Heart toggle backed by `useWishlist()`. Props `{productId, productName?, variant?:'overlay'|'inline', withLabel?,
className?}`. `overlay` = round chip floating over a card image (used by `ProductCard` grid+list, self-preventing the
card `<Link>` navigation); `inline` = bordered pill for the PDP buy box. `aria-pressed` reflects wishlisted state,
gold focus ring, filled gold heart when saved. All optimism/rollback/auth-gating lives in the context, so the button
needs no props beyond the product and can be embedded anywhere without prop threading.

### `@/components/AddToBagButton`
Quick-add on a catalogue card, backed by `useCart()`. Props `{product:ProductSummaryResponse, className?}`. Four states,
in order: **sold out** (`stockQuantity<=0`, disabled) → **choose options** (`hasVariants`, a `<Link>` to the PDP, never an
add) → **add to bag** (variantless, not in the bag) → **−/+ stepper** showing "N in bag", where `−` at 1 removes the line.
`+` is disabled at `stockQuantity`. Every handler calls `stopPropagation`/`preventDefault` because the control sits inside
a card whose whole surface links to the PDP. All network/auth/toast behaviour lives in `useCart()`, so like
`WishlistButton` it needs no props beyond the product.

**`ProductCard` is no longer an `<a>` wrapped around everything.** It is a `relative` container; the title holds the only
link, stretched over the card with `after:absolute after:inset-0` (the Bootstrap `stretched-link` idea). That keeps the
whole card clickable while the bag/wishlist controls stay real buttons — interactive elements cannot legally nest inside
an anchor, and a click on `+` must not also navigate. Anything meant to stay clickable needs to out-rank the stretched
pseudo-element: the wishlist chip is `z-20`, the buy row `z-10`.

### App-wide UX infrastructure (WP-1.4)
Cross-cutting infra wired into the router (`App.tsx`) and root (`main.tsx`). Reuse these on every new page.

- **Code splitting:** *every* page is `React.lazy`-loaded (storefront, auth, admin). Each route element is
  wrapped by a small `Page` helper in `App.tsx` that provides the `<Suspense>` boundary and an optional
  per-route document title. New pages: add a `lazy(() => import(...))` + a `<Route element={<Page …>}>`.
- **`@/components/RouteSkeletons`** — page-shaped `<Suspense>`/loading fallbacks built from the WP-1.2
  `Skeleton*` primitives: `StoreListSkeleton`, `ProductDetailSkeleton`, `ListSkeleton` (`{action?,rows?}`),
  `DetailSkeleton`, `FormSkeleton` (`{fields?}`), `DashboardSkeleton`, `AuthFormSkeleton`, plus the pieces
  `PageHeaderSkeleton`, `ProductGridSkeleton` (`{count?}`), `RowsSkeleton` (`{rows?}`), and a re-exported
  `SkeletonTable`. Used both as the route fallback (matched to page type) **and** the in-page data-loading
  branch — pages that keep their own header/filters swap only the body (`SkeletonTable`/`RowsSkeleton`).
- **`@/lib/useDocumentTitle`** — `useDocumentTitle(title?)` sets `document.title` to `Amanly — <title>`
  (bare brand when falsy). `RouteTitle {title}` is the declarative form used for static route titles in
  `App.tsx`; `TITLE_BASE` is the brand prefix. **Phase 2:** dynamic pages set specific titles from loaded data,
  e.g. `useDocumentTitle(product?.name ?? 'Product')` (see ProductDetail/OrderDetail/ProductForm for the pattern).
- **`@/components/ScrollToTop`** — mounted once in `App` above `<Routes>`. Scrolls to top on PUSH/REPLACE
  navigations (the persistent layouts never unmount, so the browser won't); defers to native anchor behavior
  when a `#hash` is present and lets the browser restore scroll on POP (back/forward).
- **`@/components/ErrorBoundary`** — `ErrorBoundary` wraps `<App/>` in `main.tsx`; renders a branded 500 screen
  (`EmptyState` + "Reload page" / "Go home") on uncaught render errors. Recovery uses a hard reload / `<a href>`
  (not SPA nav) and does not depend on Router context. Console-logs the error (Sentry deferred to WP-7.5).
- **`@/pages/NotFound`** — branded 404 (`EmptyState`). Used for `*` in **both** StoreLayout (also the global
  fallback) and AdminLayout; accepts `{homeTo?, homeLabel?}` (admin passes `/admin` / "Back to dashboard").
- **Toasts** (`ToastContext`): restyled to design-system tokens — semantic icon tint + left accent bar per kind
  (`success/danger/warning/info`), `z-toast`, `aria-live="polite"` region with `role="alert"` for error/warning
  and `role="status"` for success/info. The `useToast()` API (`success/error/info/warning/push`) is unchanged.
- `LinkButton` still has **no `onClick`** (not needed by WP-1.4 — the error screen uses `Button` + a plain
  anchor). If a future navigate-and-close pattern needs it, add it as an optional prop.

## Canonical route map (use these exact paths in all links/navigate)

Store (in `StoreLayout`): `/` Home, `/products` catalog, `/products/:slug` detail, `/cart`, `/checkout`,
`/orders`, `/orders/:id`, `/account`, `/account/wishlist` (WP-3.3b, RequireAuth), `/account/addresses`, `/account/settings`.
Auth (no layout / centered): `/login`, `/register`, `/admin/login`, `/forgot-password`, `/reset-password`,
`/verify-email`, `/oauth2-callback`.
Admin (in `AdminLayout`, guarded): `/admin` dashboard, `/admin/orders`, `/admin/orders/:id`,
`/admin/deliverables`, `/admin/coupons` (WP-3.4 — coupon CRUD, STAFF+ADMIN with ADMIN-only delete, sidebar under
Sales), `/admin/inventory`, `/admin/inventory/new`, `/admin/inventory/:id`,
`/admin/categories`, `/admin/brands` (WP-3.5 — brand CRUD/deactivate, STAFF+ADMIN, sidebar under Catalog; no
delete), `/admin/reviews` (WP-3.2b — review moderation, STAFF+ADMIN, sidebar under Catalog),
`/admin/reports`, `/admin/users`, `/admin/users/:id`, `/admin/settings`, `/admin/forbidden`.
Platform (in `PlatformLayout`, `RequirePlatformAdmin`): `/platform` stores list, `/platform/stores/:storeId`
store detail (entitlements + domains), `/platform/operators`. Reached from the admin user menu, which
shows the entry only to an operator.

## Layout & navigation chrome (WP-1.3)

The three layout shells own all site chrome; page bodies never render their own header/footer/sidebar.
`TooltipProvider` is mounted once at the app root (`main.tsx`) so tooltips share one hover-delay timer.

- **`StoreLayout`** (storefront shell):
  - Sticky header (`z-header`): brand = store name from `getPublicStore().name` (falls back to "Amanly"
    if the request fails); primary nav (Home, Shop) + a **Categories `DropdownMenu`** built from
    `getCategoryTree()` (roots + one level of children), each item linking to `/products?categoryId=<id>`;
    a debounced **`SearchInput`** (desktop) that navigates to `/products?search=<q>`; a cart button showing
    `useCart().itemCount` that opens a **slide-out mini-cart `Drawer`** (reads `useCart()`, links to `/cart`
    and `/checkout`); an account **`DropdownMenu`** (login/register when logged out; account/orders/settings/
    logout — when logged in, via `useAuth()`). Above those, the console entries: **Manage store** (`/admin`, when
    `isStaff`, labelled with the store name and Admin/Staff) and **Platform console** (`/platform`, only when
    `showsPlatformConsole`). Management sits above the shopping links; the mobile drawer repeats both.
  - Mobile: a hamburger opens a left nav `Drawer` (search + nav + categories + account actions).
  - Footer: link columns (Shop / Account / Policies / Contact), a **newsletter input UI that is stubbed**
    (no endpoint until WP-6.4 — submit shows a "coming soon" toast, nothing is stored), placeholder social
    links (`#`) and visual-only payment badges. **Policy links are `#` placeholders until WP-7.6.**
- **`AdminLayout`** (console shell):
  - Collapsible desktop sidebar with **grouped nav** (Overview / Catalog / Sales / People / Insights / System)
    + `lucide-react` icons. Collapse state persists in `localStorage['rc-admin-sidebar-collapsed']`; collapsed
    mode shows icon-only links with `Tooltip` labels. **Role-gated:** Users + Settings are ADMIN-only
    (`useAuth().isAdmin`); everything else is STAFF+. Hidden items (and empty groups) are not rendered.
  - Topbar: mobile menu toggle, store name (`getPublicStore()`), user **`DropdownMenu`** (view storefront,
    logout). Below it, a **`Breadcrumbs`** slot derived from the route path (pages may refine later).
  - Mobile: hamburger opens a left `Drawer` with the full grouped nav.
- **`AuthLayout`** (centered card shell): brand mark + card on the ambient background; unchanged API
  (`{title, subtitle?, children, footer?}`), lightly restyled to design-system type/elevation tokens.

Data sources are all existing contracts — no new endpoints: `getPublicStore()`, `getCategoryTree()`,
`useCart()`, `useAuth()`. The router structure and all route guards are unchanged by WP-1.3.

## Backend limitations to handle gracefully (do not invent endpoints)
- Saved addresses are a **real backend entity** — use `@/api/addresses` (`listAddresses`/`addAddress`/
  `updateAddress`/`setDefaultAddress`/`deleteAddress`, backed by `/api/v1/users/me/addresses`, types
  `AddressResponse`/`AddressRequest`) for `/account/addresses` and the checkout address step. Map
  `AddressResponse` → the `ShippingAddressRequest`/`shippingAddress` shape for `placeOrder`
  (`recipientName` → `name`; `phone`/`addressLine2`/`state` are nullable pass-throughs). The legacy
  `@/lib/addressBook` (localStorage) is **superseded** and must not be used for address CRUD or checkout.
- Stats/reports endpoints exist (WP-3.1a) → use `@/api/stats` (`adminStats`), not client-side aggregation.
  `Dashboard.tsx` and `Reports.tsx` are built on `overview` / `revenue-series` / `top-products` / `low-stock`
  (STAFF+ADMIN), with a 7/30/90-day range control; recent-orders still legitimately uses `adminOrders.list`.
  The old page-and-aggregate workarounds have been deleted. Charts use the WP-1.2 themed wrappers
  (`ThemedAreaChart`/`ThemedBarChart`). Best-sellers rail (Home) uses public `getTopProducts`.
  NOTE: no payment-method / country breakdown endpoint exists — those Reports charts were dropped (not
  re-derived client-side). PLP "popularity" sort stays deferred: `/products/top` can't be filtered/paginated,
  so it can't back the PLP's composable sort (needs a `sort=popular` key on the public search endpoint).
- **PLP rating filter/sort stays backend-blocked (after WP-3.2b).** Product cards now show rating stars
  (`ratingAvg`/`ratingCount` on `ProductSummaryResponse`), but the public search endpoint exposes no
  `minRating` filter or `sort=rating` key — a client-side version would only reorder the current page.
  Not built; needs those params on `/api/v1/products`. See the deferral comment in `Products.tsx`.
- **Coupon flow (WP-3.4).** Cart's promo input calls `validateCoupon` (advisory, always-200 — read `valid`),
  shows the discount (green success + "−$X") or the rejection `message`, and persists a valid code to
  localStorage (`@/lib/couponStorage`, key `rc-applied-coupon`). Checkout re-validates that code against the
  CURRENT cart on entry; if it's no longer valid it's dropped with a notice (placement rejects an invalid code
  outright — it is never silently dropped). `placeOrder` sends `couponCode` only when the re-validation confirmed
  it; the placed `OrderResponse.discountAmount`/`couponCode` are authoritative and may differ from the preview if
  the cart changed. On successful placement the stored code is cleared. Discount lines render in the Cart summary,
  Checkout summary, and both customer + admin order detail (only when `discountAmount > 0`). Preview requires auth
  (Cart/Checkout are already `RequireAuth`). The admin `/admin/coupons` page is STAFF+ADMIN (page under the existing
  `RequireStaff` block; the destructive **delete** action is gated to ADMIN via `useAuth().isAdmin`, matching the
  backend where DELETE is ADMIN-only and list/CRUD/deactivate are STAFF+ADMIN); a used coupon can't be deleted
  (409 → the UI steers you to deactivate).
- **Variants & brands (WP-3.5).** PDP (`ProductDetail`) renders a variant selector when the product has ≥1
  active variant: it derives one radiogroup per option axis from the variants' `options` maps, resolves the
  selected variant, and shows its `effectivePrice`/`stockQuantity`/pinned image reactively (a range "from…" until a
  full combination is chosen). Incompatible option combos are disabled; a full selection is REQUIRED before add,
  which sends `variantId` (with a `VARIANT_REQUIRED` guard). Variantless products behave exactly as before (no
  selector, add without `variantId`). The PLP (`Products`) adds a **brand facet** from `listBrands()` → `?brandId=`
  URL param (composes with the other filters + chips + clear). The admin product form (`ProductForm`) gains a
  **brand selector** (optional, keeps an inactive assigned brand selectable) and a **variant editor** (edit mode
  only — variants need a saved productId; create mode shows a note): add/edit/delete variants (options as key/value
  rows, price override, active, optional pinned image), set per-variant stock via the dedicated PATCH. Cart page +
  mini-cart show `variantOptionsLabel`/`variantSku` and are variant-aware (update/remove key by cart line + pass
  `variantId`); customer + admin order detail show `variantOptions`. Mixed carts (variant + variantless lines) are
  handled. Brand/colour/size are NOT public search facets beyond brand — variant options aren't a search param.
- No order status filter on the API → fetch a page and filter client-side where needed (e.g. Deliverables).
- Product images: create via `CreateProductRequest.images`; after creation manage via
  `adminProducts.addImages` / `deleteImage`. `UpdateProductRequest` cannot change slug/sku/images.
