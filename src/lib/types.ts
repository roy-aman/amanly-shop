/* ===================================================================
   Amanly — API type contracts
   These mirror the backend DTOs and enums EXACTLY (verified against the
   Spring controllers/DTOs). Keep in sync with src/main/java/.../*.dto.
   =================================================================== */

// ── Enums (verbatim backend constants) ────────────────────────────────
// `PLATFORM_ADMIN` is the platform-operator role. It is GLOBAL (the same account
// holds it at every store) while every other role is per store, so it is the one
// role that may be read from the session at any store's domain — see
// docs/platform-console-guide.md §2.3.
export type RoleName = 'CUSTOMER' | 'STAFF' | 'ADMIN' | 'PLATFORM_ADMIN';
export type UserStatus = 'ACTIVE' | 'LOCKED' | 'DISABLED';
export type AuthProvider = 'LOCAL' | 'GOOGLE';
export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type OrderStatus = 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type OrderPaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'PARTIALLY_REFUNDED' | 'REFUNDED';
export type PaymentMethod = 'CASH' | 'UPI' | 'RAZORPAY';
export type StoreStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED';

// ── Error envelope ────────────────────────────────────────────────────
export interface FieldViolation {
  field: string;
  message: string;
}
export interface ErrorEnvelope {
  timestamp: string;
  status: number;
  error: string;
  code: string;
  message: string;
  path: string;
  fieldViolations?: FieldViolation[];
}

// ── Pagination (raw Spring Data Page) ─────────────────────────────────
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number; // 0-based current page
  size: number;
  first: boolean;
  last: boolean;
  numberOfElements: number;
  empty: boolean;
}

// ── Auth / User ───────────────────────────────────────────────────────
export interface UserResponse {
  id: string;
  email: string;
  fullName: string;
  provider: AuthProvider;
  status: UserStatus;
  roles: RoleName[];
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  tokenType: string; // "Bearer"
  accessToken: string;
  expiresInSeconds: number;
  refreshToken: string;
  user: UserResponse;
}

// ── Catalog: category ─────────────────────────────────────────────────
export interface CategoryResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  parentName: string | null;
  depth: number;
  sortOrder: number;
  active: boolean;
  imageUrl: string | null;
  imageAltText: string | null;
  bannerUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryTreeResponse {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  // Carried on the tree so the home page can draw category tiles without a
  // second round trip per category just to find out what picture to show.
  imageUrl: string | null;
  imageAltText: string | null;
  children: CategoryTreeResponse[];
}

// ── Catalog: brand (WP-3.5) ───────────────────────────────────────────
// Mirrors com.royalcommerce.application.brand.dto.*.
export interface BrandResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Create a brand (STAFF+ADMIN). 409 BRAND_SLUG_EXISTS on a duplicate slug. `active` defaults true. */
export interface CreateBrandRequest {
  name: string;
  slug: string;
  description?: string | null;
  logoUrl?: string | null;
  active?: boolean | null;
}

/** Fully replace a brand's fields (STAFF+ADMIN). Unlike create, `active` is required. */
export interface UpdateBrandRequest {
  name: string;
  slug: string;
  description?: string | null;
  logoUrl?: string | null;
  active: boolean;
}

// ── Catalog: product variant (WP-3.5) ─────────────────────────────────
// Mirrors com.royalcommerce.application.product.dto.*. A product with ≥1 ACTIVE
// variant is variant-based: a variantId is then required to add it to the cart.
export interface ProductVariantResponse {
  /** EAN-13 for the unit that crosses a counter. Assigned by the server when left blank. */
  barcode: string | null;
  id: string;
  sku: string;
  /** Option axes, e.g. { size: 'M', color: 'Red' }. Keys are sorted by the backend. */
  options: Record<string, string>;
  /** Human label of the combination, e.g. "color: Red, size: M". */
  optionsLabel: string;
  /** Raw per-variant price override; null when the variant inherits the product price. */
  priceOverride: number | null;
  /** Price a buyer pays: the override when set, else the product price. */
  effectivePrice: number;
  stockQuantity: number;
  imageId: string | null;
  active: boolean;
}

/** Create a variant. `options` must be non-empty; SKU is uppercase/digits/hyphen.
 *  409 VARIANT_SKU_EXISTS / VARIANT_OPTIONS_EXISTS on a collision. */
export interface CreateVariantRequest {
  sku: string;
  options: Record<string, string>;
  /** Leave undefined/blank and the server generates a unique EAN-13. */
  barcode?: string | null;
  price?: number | null;
  stockQuantity?: number | null;
  imageId?: string | null;
  active?: boolean | null;
}

/** Edit a variant's mutable fields (SKU is immutable; stock via the stock endpoint). */
export interface UpdateVariantRequest {
  /** Blank KEEPS the current barcode — it does not clear or regenerate it. */
  barcode?: string | null;
  options: Record<string, string>;
  price?: number | null;
  imageId?: string | null;
  active: boolean;
}

// ── Catalog: product ──────────────────────────────────────────────────
export interface ProductImageResponse {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
}

export interface ProductResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  sku: string;
  price: number;
  compareAtPrice: number | null;
  currency: string;
  status: ProductStatus;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  /** Brand id/name (WP-3.5); null when the product has no brand. Optional so pre-3.5
   *  cached payloads still type-check. */
  brandId?: string | null;
  brandName?: string | null;
  weight: number | null;
  sellingUnit: string | null;
  stockQuantity: number;
  tags: string[];
  images: ProductImageResponse[];
  /** Purchasable variants (WP-3.5). Empty/absent for a variantless product; when it has
   *  ≥1 active variant a variantId is required to add it to the cart. */
  variants?: ProductVariantResponse[];
  /** Average rating over APPROVED reviews (WP-3.2). null when none yet. Optional
   *  so pre-WP-3.2 cached payloads (e.g. localStorage summaries) still type-check. */
  ratingAvg?: number | null;
  /** Number of APPROVED reviews (0 when none). Optional for the same reason. */
  ratingCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductSummaryResponse {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: number;
  compareAtPrice: number | null;
  currency: string;
  status: ProductStatus;
  categoryName: string | null;
  /** Brand id/name (WP-3.5); null when the product has no brand. Optional so pre-3.5
   *  cached payloads (e.g. localStorage recently-viewed summaries) still type-check. */
  brandId?: string | null;
  brandName?: string | null;
  primaryImageUrl: string | null;
  stockQuantity: number;
  /** Average rating over APPROVED reviews (WP-3.2). null when none yet. Optional
   *  so pre-WP-3.2 cached payloads (e.g. localStorage summaries) still type-check. */
  ratingAvg?: number | null;
  /** Number of APPROVED reviews (0 when none). Optional for the same reason. */
  ratingCount?: number;
}

export interface ProductImageRequest {
  url: string;
  altText?: string | null;
  sortOrder: number;
  isPrimary: boolean;
}

export interface CreateProductRequest {
  name: string;
  slug: string;
  sku: string;
  price: number;
  compareAtPrice?: number | null;
  currency: string;
  categoryId?: string | null;
  /** Optional brand id (WP-3.5). */
  brandId?: string | null;
  description?: string | null;
  shortDescription?: string | null;
  weight?: number | null;
  sellingUnit?: string | null;
  tags?: string[];
  images?: ProductImageRequest[];
  stockQuantity?: number | null;
}

export interface UpdateProductRequest {
  name: string;
  description?: string | null;
  shortDescription?: string | null;
  price: number;
  compareAtPrice?: number | null;
  currency: string;
  categoryId?: string | null;
  /** Optional brand id (WP-3.5). Send null to clear the current brand. */
  brandId?: string | null;
  weight?: number | null;
  sellingUnit?: string | null;
  tags?: string[];
  stockQuantity?: number | null;
}

export interface ProductSearchParams {
  categoryId?: string;
  /** Filter by brand (WP-3.5); composes with the other params. */
  brandId?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  tag?: string;
  status?: ProductStatus; // admin only
  page?: number;
  size?: number;
  sort?: string;
}

// ── Category requests ─────────────────────────────────────────────────
export interface CreateCategoryRequest {
  name: string;
  slug: string;
  description?: string | null;
  parentId?: string | null;
  imageUrl?: string | null;
  imageAltText?: string | null;
  bannerUrl?: string | null;
}
export interface UpdateCategoryRequest {
  name: string;
  description?: string | null;
  sortOrder?: number | null;
  active?: boolean | null;
  imageUrl?: string | null;
  imageAltText?: string | null;
  bannerUrl?: string | null;
}

// ── Cart ──────────────────────────────────────────────────────────────
export interface CartItemResponse {
  cartItemId: string;
  productId: string;
  productName: string;
  productSlug: string;
  sku: string;
  /** Chosen variant (WP-3.5); all null for a variantless line. Optional so pre-3.5
   *  payloads still type-check. */
  variantId?: string | null;
  variantSku?: string | null;
  variantOptionsLabel?: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  reservationRemainingMinutes: number | null;
}
export interface CartResponse {
  cartId: string;
  userId: string;
  items: CartItemResponse[];
  totalAmount: number;
  currency: string;
}

// ── Orders ────────────────────────────────────────────────────────────
export interface ShippingDetails {
  name: string;
  phone: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
}
export type ShippingAddressRequest = ShippingDetails;

export interface OrderItemResponse {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  /** Chosen variant snapshot at placement (WP-3.5); all null for a variantless line.
   *  Optional so pre-3.5 payloads still type-check. */
  variantId?: string | null;
  variantSku?: string | null;
  variantOptions?: string | null;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

export interface PaymentAction {
  provider: string; // "RAZORPAY"
  razorpayKeyId: string;
  razorpayOrderId: string;
  amountMinor: number;
  currency: string;
}

export interface OrderResponse {
  id: string;
  /** Human-facing reference (e.g. "AM-1042"). Optional so pre-WP-P.6 cached
   *  payloads still compile; fall back to a shortened `id` when absent. */
  orderNumber?: string | null;
  userId: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: OrderPaymentStatus;
  /** The amount actually payable — complete, including shipping and (when
   *  `taxInclusive`) tax. Always render this figure rather than re-deriving it. */
  totalAmount: number;
  /** Goods total before discount, shipping and tax (WP-P.6). Optional: older
   *  cached payloads predate it, so read it through `orderTotals()`. */
  subtotalAmount?: number;
  /** Coupon discount applied at placement; 0 when no coupon was used (WP-3.4). */
  discountAmount: number;
  /** Delivery charged at placement; 0 when the order qualified for free
   *  delivery or the store charges none (WP-P.6). */
  shippingAmount?: number;
  /** Tax on the order. When `taxInclusive` is true this is the portion ALREADY
   *  inside `totalAmount` — adding it again double-counts (WP-P.6). */
  taxAmount?: number;
  /** Rate snapshotted at placement, so editing store settings never rewrites a
   *  placed order's figures (WP-P.6). */
  taxRatePercent?: number;
  /** Whether displayed prices already contain the tax (WP-P.6). */
  taxInclusive?: boolean;
  /** Coupon code applied at placement; null when none was used (WP-3.4). */
  couponCode: string | null;
  currency: string;
  shippingAddress: ShippingDetails;
  notes: string | null;
  items: OrderItemResponse[];
  paymentAction: PaymentAction | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderSummaryResponse {
  id: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  totalAmount: number;
  currency: string;
  itemCount: number;
  shippingCity: string | null;
  shippingCountry: string | null;
  createdAt: string;
}

export interface PlaceOrderRequest {
  shippingAddress: ShippingAddressRequest;
  notes?: string | null;
  paymentMethod?: PaymentMethod;
  /** Optional coupon code (WP-3.4). Re-validated authoritatively at placement
   *  against the server cart; an invalid coupon REJECTS the order (never silently
   *  dropped), so only send a code the preview reported valid. */
  couponCode?: string | null;
}

export interface RazorpayVerifyRequest {
  orderId: string;
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
}

// ── Store ─────────────────────────────────────────────────────────────
/**
 * `GET /api/v1/store` — the bootstrap call. The backend picks WHICH store this
 * describes from the request's Host header, so nothing here may be hardcoded.
 *
 * The commerce fields (WP-P.6) are what let the storefront quote delivery and
 * label tax before an order exists. There is no cart totals-preview endpoint:
 * any pre-checkout figure is the storefront applying these rules itself, and
 * the placed `OrderResponse` stays authoritative.
 */
export interface PublicStoreResponse {
  /** Tenant key. Namespaces anything this browser persists for this store. */
  slug: string;
  name: string;
  currency: string;
  codEnabled: boolean;
  onlinePaymentEnabled: boolean;
  /** Flat delivery charge applied when the order is below the threshold. */
  shippingFlatAmount?: number;
  /** Discounted subtotal at or above this ships free. `null` = never free. */
  freeShippingThreshold?: number | null;
  taxRatePercent?: number;
  /** true → shelf prices already include tax; false → tax is added at checkout. */
  pricesIncludeTax?: boolean;
  /** Storefront opening copy. `null` means the merchant has written none and the
   *  storefront's own default text should be used — the server deliberately does
   *  not pre-fill it, so the default can be improved without a migration. */
  heroEyebrow?: string | null;
  /** Newlines are line breaks. */
  heroHeadline?: string | null;
  heroSubtext?: string | null;
}

export interface StoreSettingsResponse {
  id: string;
  slug: string;
  name: string;
  currency: string;
  status: StoreStatus;
  codEnabled: boolean;
  onlinePaymentEnabled: boolean;
  razorpayKeyId: string | null;
  razorpayConfigured: boolean;
  whatsappEnabled: boolean;
  /** Commerce rules (WP-P.6) — same figures the storefront reads from /store. */
  shippingFlatAmount?: number;
  freeShippingThreshold?: number | null;
  taxRatePercent?: number;
  pricesIncludeTax?: boolean;
  /** Storefront opening copy. `null` = the merchant has written none, so show the
   *  field empty with the default as placeholder rather than as a value. */
  heroEyebrow?: string | null;
  heroHeadline?: string | null;
  heroSubtext?: string | null;
}

/**
 * `PUT /api/v1/admin/store/storefront-content` (ADMIN).
 *
 * A blank field restores the storefront's default for that line rather than
 * rendering an empty one — which is the only way a merchant can undo an edit.
 * Only shown when no home-page banner is booked; a live campaign takes the
 * first screen instead.
 */
export interface UpdateStorefrontContentRequest {
  heroEyebrow?: string | null;
  /** Newlines are line breaks. */
  heroHeadline?: string | null;
  heroSubtext?: string | null;
}

/**
 * `PUT /api/v1/admin/store/commerce-settings` (ADMIN).
 *
 * Applies to FUTURE orders only — placed orders keep their snapshot. Every
 * field is applied as sent, so load the current values before submitting.
 */
export interface UpdateCommerceSettingsRequest {
  shippingFlatAmount: number;
  /** null = never free. */
  freeShippingThreshold?: number | null;
  taxRatePercent: number;
  pricesIncludeTax: boolean;
  /** Days a delivered order stays returnable. null = returns disabled. */
  returnWindowDays?: number | null;
}

export interface UpdatePaymentSettingsRequest {
  codEnabled: boolean;
  onlinePaymentEnabled: boolean;
  razorpayKeyId?: string | null;
  razorpayKeySecret?: string | null;
  razorpayWebhookSecret?: string | null;
}

export interface UpdateWhatsappSettingsRequest {
  enabled: boolean;
  phoneNumberId?: string | null;
  accessToken?: string | null;
  verifyToken?: string | null;
  appSecret?: string | null;
}

// ── Admin stats & reports (WP-3.1) ────────────────────────────────────
// Mirrors com.royalcommerce.application.stats.dto.*. All money is an exact
// BigDecimal serialized as a JSON number, in the store currency (no currency
// field on the DTOs — use getPublicStore().currency). `changePct` is null when
// the previous period was zero (render "—", never 0).
export interface StatsMoneyMetric {
  current: number;
  previous: number;
  changePct: number | null;
}
export interface StatsCountMetric {
  current: number;
  previous: number;
  changePct: number | null;
}
export interface StatsOverviewResponse {
  from: string; // yyyy-MM-dd
  to: string; // yyyy-MM-dd
  revenue: StatsMoneyMetric; // paid orders only
  paidOrders: StatsCountMetric;
  totalOrders: StatsCountMetric;
  customers: StatsCountMetric;
  averageOrderValue: StatsMoneyMetric;
  /** Always contains all five statuses, zero-filled. */
  ordersByStatus: Record<OrderStatus, number>;
}

export type RevenueGranularity = 'day' | 'week' | 'month';
export interface RevenueSeriesPoint {
  periodStart: string; // yyyy-MM-dd (Monday for week, 1st for month)
  revenue: number;
  orderCount: number;
}
export interface RevenueSeriesResponse {
  from: string;
  to: string;
  granularity: string; // 'DAY' | 'WEEK' | 'MONTH' (echoed back uppercased)
  /** Contiguous / zero-filled across the range — plot as-is, no gap-filling. */
  points: RevenueSeriesPoint[];
}

export interface TopProductStat {
  productId: string;
  name: string;
  slug: string | null; // null for a deleted product
  unitsSold: number;
  revenue: number;
}

export interface LowStockProduct {
  productId: string;
  name: string;
  slug: string | null;
  sku: string;
  stockQuantity: number;
  status: ProductStatus;
}

// ── Admin user requests ───────────────────────────────────────────────
export interface AdminCreateUserRequest {
  email: string;
  fullName: string;
  password: string;
  roles: RoleName[];
}
export interface ChangeUserRolesRequest {
  roles: RoleName[];
}

// ── Saved addresses (backend address book at /users/me/addresses) ──────
export interface AddressResponse {
  id: string;
  label: string;
  recipientName: string;
  phone: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AddressRequest {
  label: string;
  recipientName: string;
  phone?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state?: string | null;
  postalCode: string;
  country: string;
  makeDefault: boolean;
}

// ── Reviews & ratings (WP-3.2) ────────────────────────────────────────
// Mirrors com.royalcommerce.application.review.dto.*.
export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/** A publicly visible (APPROVED) review — no reviewer id/email, only a display name. */
export interface ReviewResponse {
  id: string;
  rating: number; // 1..5
  title: string | null;
  body: string | null;
  reviewerName: string;
  verifiedPurchase: boolean;
  createdAt: string;
}

/** Aggregate rating over APPROVED reviews. `average` is null when there are none;
 *  `buckets` is always keyed "1".."5" (zero-filled). */
export interface ReviewSummaryResponse {
  average: number | null;
  count: number;
  buckets: Record<string, number>;
}

/** The authenticated user's own review (any status, so they see moderation state). */
export interface MyReview {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: ReviewStatus;
  verifiedPurchase: boolean;
  createdAt: string;
  updatedAt: string;
}

/** My review + eligibility. `canReview === purchased && review == null`. */
export interface MyReviewResponse {
  purchased: boolean;
  canReview: boolean;
  review: MyReview | null;
}

export interface CreateReviewRequest {
  rating: number; // 1..5
  title?: string | null;
  body?: string | null;
}

export interface UpdateReviewRequest {
  rating: number; // 1..5
  title?: string | null;
  body?: string | null;
}

/** Full review view for the moderation queue (ADMIN/STAFF only). */
export interface AdminReviewResponse {
  id: string;
  productId: string;
  userId: string;
  reviewerName: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: ReviewStatus;
  verifiedPurchase: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Wishlist (WP-3.3) ─────────────────────────────────────────────────
// Mirrors com.royalcommerce.application.wishlist.dto.WishlistMutationResponse.
/**
 * Result of an idempotent wishlist add/remove. `wishlisted` is the product's
 * resulting state (true after add, false after remove); `wishlistCount` is the
 * user's total wishlist size afterwards — enough to confirm a heart toggle and
 * update a badge without a follow-up request. The wishlist itself is read as
 * `ProductSummaryResponse[]` (full list) or `string[]` (ids for heart state).
 */
export interface WishlistMutationResponse {
  productId: string;
  wishlisted: boolean;
  wishlistCount: number;
}

// ── Coupons & discounts (WP-3.4) ──────────────────────────────────────
// Mirrors com.royalcommerce.application.coupon.dto.* and domain enums.
export type CouponType = 'PERCENT' | 'FIXED';

/** The single, precise reason a coupon could not be applied (backend enum). */
export type CouponRejectionReason =
  | 'NOT_FOUND'
  | 'INACTIVE'
  | 'NOT_STARTED'
  | 'EXPIRED'
  | 'MIN_ORDER_NOT_MET'
  | 'MAX_REDEMPTIONS_REACHED'
  | 'PER_USER_LIMIT_REACHED';

/** Customer coupon preview request (POST /coupons/validate). `subtotal` is an
 *  optional fallback — ignored by the server when the caller has a non-empty cart. */
export interface CouponValidationRequest {
  code: string;
  subtotal?: number | null;
}

/**
 * Advisory result of a coupon preview — ALWAYS returned with HTTP 200 (a rejected
 * coupon is a normal outcome, not an error). Read `valid`: when true, `reason` is
 * null and `discountAmount`/`total` are populated; when false, `reason`/`message`
 * explain why and the money fields are null. The authoritative discount is recomputed
 * server-side at placement (see `OrderResponse.discountAmount`).
 */
export interface CouponPreviewResponse {
  valid: boolean;
  code: string;
  reason: CouponRejectionReason | null;
  message: string;
  subtotal: number;
  discountAmount: number | null;
  total: number | null;
}

/** Full coupon view for the admin console, including the live redemption count. */
export interface AdminCouponResponse {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  minOrderAmount: number | null;
  startsAt: string | null; // ISO instant
  endsAt: string | null; // ISO instant
  maxRedemptions: number | null;
  perUserLimit: number | null;
  active: boolean;
  totalRedemptions: number;
  createdAt: string;
  updatedAt: string;
}

/** Create a coupon. Cross-field rules (PERCENT ≤ 100, ends after starts) are
 *  enforced server-side (surfaced as INVALID_COUPON). `active` defaults to true. */
export interface CreateCouponRequest {
  code: string;
  type: CouponType;
  value: number;
  minOrderAmount?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  maxRedemptions?: number | null;
  perUserLimit?: number | null;
  active?: boolean | null;
}

/** Fully replace a coupon's fields. Unlike create, `active` is required. */
export interface UpdateCouponRequest {
  code: string;
  type: CouponType;
  value: number;
  minOrderAmount?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  maxRedemptions?: number | null;
  perUserLimit?: number | null;
  active: boolean;
}

// ── Two-step sign-in for platform operators ───────────────────────────
// Mirrors POST /api/v1/auth/login, which answers with EITHER shape:
//   200 → AuthResponse            ordinary user, session issued
//   202 → OtpChallengeResponse    correct password, now prove it's you
// Branch on the STATUS CODE, not on which fields happen to be present — the
// same form posts both outcomes. See docs/platform-console-guide.md §2.
export interface OtpChallengeResponse {
  status: 'OTP_REQUIRED';
  message: string;
  /** DEV ONLY. Non-null only while `app.auth.expose-verification-otp` is on
   *  (barred from production by a startup guard) because outbound email is not
   *  wired up yet. Treat as a convenience for prefilling; the typed input must
   *  remain the real path. */
  otp?: string | null;
}

/** Discriminated result of `login()` — the caller must handle both arms. */
export type LoginResult =
  | { kind: 'session'; auth: AuthResponse }
  | { kind: 'otpRequired'; challenge: OtpChallengeResponse };

export interface VerifyLoginOtpRequest {
  email: string;
  code: string;
}

// ── Platform surface (PLATFORM_ADMIN) ─────────────────────────────────
// Mirrors com.royalcommerce.application.platform.dto.*. Not part of the
// storefront: these endpoints manage the OTHER stores on the platform.

/**
 * One store as the platform sees it. Note the two families of flag:
 * `*Configured` is what actually works (the merchant did their setup);
 * `*Allowed` is what the platform permits. They differ whenever a merchant
 * has not configured a capability they are entitled to — an operator
 * debugging "why can't they take payments" needs both.
 */
export interface StoreAdminSummaryResponse {
  id: string;
  slug: string;
  name: string;
  status: StoreStatus;
  currency: string;
  codEnabled: boolean;
  onlinePaymentConfigured: boolean;
  whatsappConfigured: boolean;
  // ── Entitlements ──
  onlinePaymentsAllowed: boolean;
  whatsappNotificationsAllowed: boolean;
  whatsappCommerceAllowed: boolean;
  emailNotificationsAllowed: boolean;
  marketingEmailAllowed: boolean;
  customDomainAllowed: boolean;
  imageUploadAllowed: boolean;
  aiImageGenerationAllowed: boolean;
  bookingsAllowed: boolean;
  /** Max STAFF/ADMIN members. null = unlimited. Never send 0. */
  maxStaffSeats: number | null;
  maxImageUploads: number | null;
  maxAiImageGenerations: number | null;
  createdAt: string;
}

/** `adminEmail` + `adminPassword` also create the store's first ADMIN. Without
 *  one the store cannot be signed into and is inert, so the UI pushes for it. */
export interface CreateStoreRequest {
  slug: string;
  name: string;
  currency?: string;
  /** Supplying a domain also grants the custom-domain entitlement. */
  customDomain?: string | null;
  adminEmail?: string | null;
  adminFullName?: string | null;
  adminPassword?: string | null;
}

/** `slug` is immutable — it appears in URLs and may be referenced by DNS. */
export interface UpdateStoreRequest {
  name?: string | null;
  status?: StoreStatus | null;
}

/**
 * A PUT in PATCH's clothing: every field is applied as given, so send the whole
 * object or you silently switch capabilities off.
 *
 * Every boolean below is REQUIRED, and the API means it: omitting one is a 400,
 * not a defaulted `false`. That is deliberate on their side — a console that
 * predates a capability must not be able to withdraw it by never having heard of
 * it — but it does mean this interface has to gain each new flag in step with the
 * backend, or saving entitlements stops working altogether.
 */
export interface UpdateStoreEntitlementsRequest {
  onlinePaymentsAllowed: boolean;
  whatsappNotificationsAllowed: boolean;
  whatsappCommerceAllowed: boolean;
  emailNotificationsAllowed: boolean;
  marketingEmailAllowed: boolean;
  customDomainAllowed: boolean;
  imageUploadAllowed: boolean;
  aiImageGenerationAllowed: boolean;
  bookingsAllowed: boolean;
  maxStaffSeats?: number | null;
  maxImageUploads?: number | null;
  maxAiImageGenerations?: number | null;
}

export interface StoreDomainResponse {
  id: string;
  hostname: string;
  /** Exactly one per store: the canonical address order email and reset links
   *  point at. Cannot be removed while other domains remain. */
  primary: boolean;
  createdAt: string;
}

/** Hostnames are normalised server-side ("HTTPS://NovaSports.in/shop " →
 *  "novasports.in"), so a pasted URL is accepted — show what was stored. */
export interface AddStoreDomainRequest {
  hostname: string;
  makePrimary?: boolean;
}

export interface PlatformAdminResponse {
  userId: string;
  email: string;
  fullName: string;
  since: string;
}

/** Appoints an EXISTING account. 404 USER_NOT_FOUND means "ask them to sign up
 *  first", not "no such person". */
export interface GrantPlatformAdminRequest {
  email: string;
}

// ── Platform: recorded failures ───────────────────────────────────────
/** Where a failure was caught. Background sources carry no request, so the HTTP
 *  fields below are null for them. `PLAN_LIMIT` is not a failure at all — a store
 *  refused for want of an entitlement or quota, kept because it is a sales signal
 *  and grouped per store rather than platform-wide. */
export type ErrorSource = 'HTTP' | 'SCHEDULED' | 'ASYNC' | 'EMAIL' | 'PLAN_LIMIT';

/** One distinct failure, not one occurrence — `occurrences` counts how many times
 *  it has happened. Rejected requests (bad password, forbidden, validation) are
 *  never recorded, so everything here is something that actually broke. */
export interface ErrorEventResponse {
  id: string;
  /** Quotable code, e.g. ERR-7K4QP2X9, also returned to the caller in the 500. */
  reference: string;
  occurrences: number;
  firstSeenAt: string;
  lastSeenAt: string;
  source: ErrorSource;
  storeId: string | null;
  httpMethod: string | null;
  path: string | null;
  status: number | null;
  exceptionClass: string;
  message: string | null;
  resolved: boolean;
  /** Muted issues are no longer recorded at all; a recurrence does NOT unmute them. */
  muted: boolean;
}

/** No request body and no headers, deliberately: those carry passwords and bearer
 *  tokens. `queryString` is present with credential-looking values masked. */
export interface ErrorEventDetailResponse {
  summary: ErrorEventResponse;
  queryString: string | null;
  userId: string | null;
  stackTrace: string | null;
  resolvedBy: string | null;
}

// ── Banners ───────────────────────────────────────────────────────────
// Mirrors com.royalcommerce.application.banner.dto.*.

/**
 * Where a banner appears. A closed set, because the storefront has to know how
 * to lay each one out — a placement it does not recognise is a banner nobody
 * ever sees.
 */
export type BannerPlacement = 'HOME_HERO' | 'HOME_STRIP' | 'PLP_STRIP';

export interface BannerResponse {
  id: string;
  placement: BannerPlacement;
  imageUrl: string;
  /** Narrow crop for phones. Falls back to imageUrl when null. */
  mobileImageUrl: string | null;
  altText: string | null;
  linkUrl: string | null;
  headline: string | null;
  subtext: string | null;
  ctaLabel: string | null;
  sortOrder: number;
  /** The merchant's switch, independent of the schedule below. */
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  /**
   * Whether a customer would see this right now — computed by the backend from
   * `active` AND the schedule. This is what tells a merchant why a banner they
   * just saved is not on the site yet.
   */
  live: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBannerRequest {
  placement: BannerPlacement;
  imageUrl: string;
  mobileImageUrl?: string | null;
  altText?: string | null;
  linkUrl?: string | null;
  headline?: string | null;
  subtext?: string | null;
  ctaLabel?: string | null;
  sortOrder?: number | null;
  active?: boolean | null;
  startsAt?: string | null;
  endsAt?: string | null;
}

/** A full replacement: fields left out are cleared, not kept. */
export type UpdateBannerRequest = CreateBannerRequest;

// ── Media uploads ─────────────────────────────────────────────────────
// Mirrors com.royalcommerce.application.media.dto.*.

export interface UploadedImageResponse {
  fileName: string;
  /** The value to store on a product, category or banner. */
  url: string;
  /** Detected from the bytes, not from the request header. */
  contentType: string;
  sizeBytes: number;
}

/** Whether this store may upload at all, and how much room is left. */
export interface UploadQuotaResponse {
  allowed: boolean;
  used: number;
  /** null = unlimited. */
  limit: number | null;
  maxFileSizeBytes: number;
  maxFilesPerRequest: number;
  /** null when there is no limit. */
  remaining: number | null;
}

// ── QR poster ─────────────────────────────────────────────────────────

/**
 * Every field is optional, and for the caption fields `undefined` and `''` mean
 * different things: omitted takes the default, empty removes that line.
 */
export interface QrCodeParams {
  /** Omit for the store's own home page, resolved server-side. */
  url?: string;
  /** Edge of the code itself, 128–2048. */
  size?: number;
  /** Omit for "Welcome to <store name>". */
  title?: string;
  /** Omit for "Scan to visit us online". */
  subtitle?: string;
}

export interface QrCodeResponse {
  /** What the code encodes. Echo it back before anyone prints it. */
  url: string;
  /** The PNG inline — usable directly as an <img> src and an <a download> href. */
  dataUri: string;
  /** Edge of the code. NOT the image size. */
  sizePx: number;
  widthPx: number;
  /** Exceeds sizePx whenever a caption is drawn, so never assume a square. */
  heightPx: number;
  format: string;
}

// ── AI image generation ───────────────────────────────────────────────
// Mirrors com.royalcommerce.application.media.dto.AiImageDtos.

/**
 * Which side of a product to generate. The view is produced purely by
 * describing it in the prompt — there is no view parameter on the upstream
 * service — so changing these means changing the wording, not a flag.
 */
export type ImageView = 'FRONT' | 'BACK' | 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM';

export interface GeneratePromptsRequest {
  /** Draft from a saved product's own category, brand and name. */
  productId?: string | null;
  productName?: string | null;
  categoryName?: string | null;
  brandName?: string | null;
  variantLabel?: string | null;
  views?: ImageView[];
  /** Draft for a category tile instead. Views are ignored. */
  forCategory?: boolean;
}

export interface PromptSuggestion {
  view: ImageView | null;
  prompt: string;
}

export interface GenerateImageRequest {
  prompt: string;
  view?: ImageView | null;
  /** What kind of thing this is ("T-shirt", "Ethnic Wear"). The generation
   *  service requires one and the API substitutes a generic value when it is
   *  absent, so naming the real category buys a better picture, not a
   *  successful request. */
  productType?: string | null;
  barcode?: string | null;
  isBundle?: boolean;
  bundleItemNames?: string | null;
}

export interface GeneratedImageResponse {
  view: ImageView | null;
  /** Kept so the wording can be tweaked and rerun without retyping it. */
  prompt: string;
  url: string;
  allUrls: string[];
}

export interface AiQuotaResponse {
  allowed: boolean;
  used: number;
  /** null = unlimited. */
  limit: number | null;
  maxViewsPerRequest: number;
  /** Measured upstream, ~10s. Used to set expectations before a long wait. */
  approxSecondsPerImage: number;
  /** null when there is no limit. */
  remaining: number | null;
}
