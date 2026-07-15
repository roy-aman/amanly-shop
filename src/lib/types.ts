/* ===================================================================
   Royal Commerce — API type contracts
   These mirror the backend DTOs and enums EXACTLY (verified against the
   Spring controllers/DTOs). Keep in sync with src/main/java/.../*.dto.
   =================================================================== */

// ── Enums (verbatim backend constants) ────────────────────────────────
export type RoleName = 'CUSTOMER' | 'STAFF' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'LOCKED' | 'DISABLED';
export type AuthProvider = 'LOCAL' | 'GOOGLE';
export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type OrderStatus = 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type OrderPaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
export type PaymentMethod = 'CASH' | 'UPI' | 'RAZORPAY';

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
  createdAt: string;
  updatedAt: string;
}

export interface CategoryTreeResponse {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  children: CategoryTreeResponse[];
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
  weight: number | null;
  sellingUnit: string | null;
  stockQuantity: number;
  tags: string[];
  images: ProductImageResponse[];
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
  weight?: number | null;
  sellingUnit?: string | null;
  tags?: string[];
  stockQuantity?: number | null;
}

export interface ProductSearchParams {
  categoryId?: string;
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
}
export interface UpdateCategoryRequest {
  name: string;
  description?: string | null;
  sortOrder?: number | null;
  active?: boolean | null;
}

// ── Cart ──────────────────────────────────────────────────────────────
export interface CartItemResponse {
  cartItemId: string;
  productId: string;
  productName: string;
  productSlug: string;
  sku: string;
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
  userId: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: OrderPaymentStatus;
  /** Amount payable AFTER any coupon discount (subtotal − discountAmount). */
  totalAmount: number;
  /** Coupon discount applied at placement; 0 when no coupon was used (WP-3.4). */
  discountAmount: number;
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
export interface PublicStoreResponse {
  name: string;
  currency: string;
  codEnabled: boolean;
  onlinePaymentEnabled: boolean;
}

export interface StoreSettingsResponse {
  id: string;
  slug: string;
  name: string;
  currency: string;
  status: string;
  codEnabled: boolean;
  onlinePaymentEnabled: boolean;
  razorpayKeyId: string | null;
  razorpayConfigured: boolean;
  whatsappEnabled: boolean;
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
