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
/** MANUAL_UPI: the customer pays the store's own UPI id directly and quotes a token to staff, who
 *  verify receipt themselves and mark the order paid — no gateway, no automatic verification. */
export type PaymentMethod = 'CASH' | 'UPI' | 'RAZORPAY' | 'MANUAL_UPI';
export type StoreStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
/** DELIVERY (default, full address required) or PICKUP (collect in person, no address needed). */
export type DeliveryMethod = 'DELIVERY' | 'PICKUP';

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
/**
 * Re-parents a category and its whole subtree.
 *
 * `parentId: null` promotes it to the top level, so "no change" is deliberately not
 * expressible — a move that could not promote would not be a move. `sortOrder` rides
 * along because a drag sets position and parent at once, and two calls would show a
 * wrong-order flicker between them.
 *
 * 400 CATEGORY_CYCLE (dropped inside its own branch, which would detach it from the
 * tree) · 400 CATEGORY_DEPTH_EXCEEDED (the moved branch's DEEPEST leaf would nest too
 * far, not the category being dragged) · 400 CATEGORY_CANNOT_PARENT_ITSELF.
 */
export interface MoveCategoryRequest {
  parentId: string | null;
  sortOrder?: number | null;
}

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
  /**
   * The wide hero for this category and its own copy, shown at the top of the listing page when a
   * shopper narrows to it. Carried here for the same reason as `imageUrl`: this is the only category
   * payload the storefront fetches. Optional so cached payloads predating them still type-check.
   */
  bannerUrl?: string | null;
  description?: string | null;
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
  /**
   * EAN-13 for the product itself — the unit that crosses a counter while it has
   * no variants. Products WITH variants carry a barcode per variant instead, so
   * this is null for them, and null for catalogue rows that pre-date barcodes.
   */
  barcode?: string | null;
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
  /**
   * Whether the product has at least one ACTIVE variant. When true it cannot be added to the bag
   * from a listing — the shopper must pick the variant on the product page first. Optional so
   * existing cached payloads (localStorage recently-viewed summaries) still type-check; an absent
   * flag reads as "no variants", which the backend rejects with VARIANT_REQUIRED if that is wrong.
   */
  hasVariants?: boolean;
}

export interface ProductImageRequest {
  url: string;
  altText?: string | null;
  sortOrder: number;
  isPrimary: boolean;
}

/** Where a bulk upload has got to. PENDING and RUNNING mean keep polling. */
export type ProductImportStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

/**
 * One problem with one row of an uploaded file.
 *
 * `line` counts CSV records, which is what a spreadsheet shows in its gutter —
 * the header is line 1, so the first product is line 2. A description containing
 * a line break still occupies one row, so this is the number to show the merchant.
 */
export interface ProductImportIssue {
  line: number;
  sku: string | null;
  /** ERROR: the row was not written. WARNING: it was, but not exactly as typed. */
  severity: 'ERROR' | 'WARNING';
  code: string;
  message: string;
}

/**
 * A bulk upload, from acceptance to report.
 *
 * COMPLETED does NOT mean every row worked — it means the file was read to the
 * end. A file where all 400 rows were rejected still COMPLETED; read
 * `failedCount`. FAILED means the file itself was unusable and no row was
 * applied; `failureMessage` says why.
 */
export interface ProductImportJobResponse {
  id: string;
  status: ProductImportStatus;
  dryRun: boolean;
  originalFilename: string;
  /** Product rows found, excluding the header and any blank rows. */
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  failedCount: number;
  issues: ProductImportIssue[];
  /** More issues occurred than are kept. The counts are still complete. */
  issuesTruncated: boolean;
  failureMessage: string | null;
  submittedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface CreateProductRequest {
  name: string;
  slug: string;
  sku: string;
  /** Blank or omitted generates one under GS1's restricted-circulation prefix.
   *  Must be free across every product AND variant in the store (409). */
  barcode?: string | null;
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
  /** Blank KEEPS the current barcode — it does not clear or regenerate it. A
   *  barcode is printed on shelf labels, so rotating it on an unrelated edit
   *  would strand every label already in the shop. */
  barcode?: string | null;
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
  /** The product's primary image, for the line's thumbnail; null when it has none. */
  productImageUrl?: string | null;
}
export interface CartResponse {
  cartId: string;
  userId: string;
  items: CartItemResponse[];
  totalAmount: number;
  currency: string;
}

// ── Orders ────────────────────────────────────────────────────────────
/**
 * Also doubles as the pickup contact for a PICKUP order: only `name` (and, where given, `phone`)
 * is meaningful then — the address fields are null, not a blank address.
 */
export interface ShippingDetails {
  name: string;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
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
  /**
   * The product's CURRENT primary image, for the line's thumbnail. Decoration, not a snapshot:
   * unlike name/sku/price it is read live, so replacing a product photo changes the thumbnail on
   * old orders too. Null when the product has no image or has since been deleted. Optional so
   * cached payloads predating it still type-check.
   */
  productImageUrl?: string | null;
}

export interface PaymentAction {
  provider: string; // "RAZORPAY"
  razorpayKeyId: string;
  razorpayOrderId: string;
  amountMinor: number;
  currency: string;
}

/**
 * A UPI application a store can hold a receiving id with.
 *
 * This names the SHOP's account, never a requirement on the customer: `upi://pay` is an open
 * standard, so money sent from PhonePe reaches an `@okaxis` handle exactly as money sent from
 * Google Pay does. It becomes visible to a customer in exactly one place — the app picker under
 * token-based verification, where the choice tells staff whose ledger to check.
 */
export type UpiApp =
  | 'GOOGLE_PAY'
  | 'PHONEPE'
  | 'PAYTM'
  | 'BHIM'
  | 'AMAZON_PAY'
  | 'WHATSAPP_PAY'
  | 'CRED'
  | 'MOBIKWIK'
  | 'FREECHARGE'
  | 'OTHER';

/** One application a customer may choose to pay from. Carries no UPI id — that arrives with the QR. */
export interface UpiAppOption {
  app: UpiApp;
  /** What to put on the button. Render this; 'PHONEPE' is not 'PhonePe'. */
  label: string;
}

/**
 * What the customer needs in order to pay this order by UPI.
 *
 * Read `tokenVerificationEnabled` FIRST — it decides which of two screens this is.
 */
export interface ManualUpiPayment {
  /** The order's payment reference; under verification also the customer's copy to quote. */
  token: string;
  /** The store's UPI id the QR pays into. */
  vpa: string;
  /** data:image/png;base64,... — render directly in an <img>. */
  qrDataUri: string;
  amount: number;
  currency: string;
  /** The application the customer chose; null for every ordinary-flow order. */
  app?: UpiApp | null;
  /** Display name of `app`; null when `app` is. */
  appLabel?: string | null;
  /**
   * False (and undefined) is the ORDINARY flow: show the QR and the amount, say it can be paid
   * from any UPI app, and show no application name and no token instructions.
   *
   * True means the store verifies payments by token: the customer already picked an application,
   * so show the token to quote alongside the QR.
   */
  tokenVerificationEnabled?: boolean;
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
  /** Optional so pre-pickup cached payloads still type-check; absent reads as 'DELIVERY'. */
  deliveryMethod?: DeliveryMethod;
  shippingAddress: ShippingDetails;
  notes: string | null;
  items: OrderItemResponse[];
  paymentAction: PaymentAction | null;
  /** Present on every read of a MANUAL_UPI order while `paymentStatus` is not 'PAID' — including
   *  the placement-time "scan to pay" screen and any later visit before it's confirmed, so a
   *  customer who navigates away can always come back to something payable. Null once paid, and
   *  for every other method; use `manualUpiToken` for the persistent token after that. */
  manualUpiPayment?: ManualUpiPayment | null;
  /** The Manual UPI token for this order, persistent once generated regardless of payment status —
   *  what the customer quotes to staff and what staff cross-check. Null for every other method. */
  manualUpiToken?: string | null;
  /**
   * The app the customer said they would pay from, persistent alongside `manualUpiToken` and
   * outliving `manualUpiPayment`, which goes null once the order is paid.
   *
   * Show it wherever you show the token: a token names a payment, and the account that payment
   * landed in is the other half of what identifies it — staff hearing "AMA-A7K42" still have to
   * know which app's ledger to open.
   *
   * Null for every generic-flow order, and that is also the persistent answer to "was this order
   * placed under token verification": an app is recorded only when it was. Branch on this rather
   * than the store's current setting, which a merchant may have changed since.
   */
  upiApp?: UpiApp | null;
  /** Display name of `upiApp`; null when it is. Render this, not the enum name. */
  upiAppLabel?: string | null;
  /** True when this is an unpaid COD order whose store has Manual UPI configured and it hasn't
   *  opted in yet (manualUpiPayment/manualUpiToken are still null) — call enableManualUpiForOrder
   *  to generate one and let the customer pay early via UPI instead of at the door. */
  manualUpiPayAvailable?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderSummaryResponse {
  id: string;
  /** The reference a customer can quote, e.g. "ORD-Y2PJYKCT". Null for orders
   *  placed before order numbers existed — fall back to a shortened `id`. */
  orderNumber?: string | null;
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
  /** For PICKUP only `name`/`phone` are required — the address fields may be omitted. */
  shippingAddress: ShippingAddressRequest;
  notes?: string | null;
  paymentMethod?: PaymentMethod;
  /** Optional coupon code (WP-3.4). Re-validated authoritatively at placement
   *  against the server cart; an invalid coupon REJECTS the order (never silently
   *  dropped), so only send a code the preview reported valid. */
  couponCode?: string | null;
  /** Defaults to 'DELIVERY'. 'PICKUP' requires the store to have pickup enabled and charges no
   *  shipping; 'DELIVERY' requires a full shippingAddress. */
  deliveryMethod?: DeliveryMethod;
  /**
   * For MANUAL_UPI only, and only where the store runs token-based verification
   * (`manualUpiTokenVerificationEnabled` on `/store`): which app the customer will pay from,
   * chosen from `manualUpiApps`. It decides which of the store's ids the QR pays into.
   *
   * Leave it undefined everywhere else. Ordinary UPI payment is generic by design, so sending one
   * has no effect and asking the customer to pick is a UI bug. Omitting it when verification IS on
   * fails with `UPI_APP_REQUIRED`; naming an app the store has not enabled, `UPI_APP_UNAVAILABLE`.
   */
  upiApp?: UpiApp | null;
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
  /** True when this store offers Manual UPI (entitled AND switched on AND a VPA is configured).
   *  Optional/undefined reads as off, the same convention as `bookingsEnabled`. */
  manualUpiEnabled?: boolean;
  /**
   * Which of the two Manual UPI screens to draw.
   *
   * False (the default) is the generic flow: one QR, payable from any UPI app, no application
   * picker and no token instructions. The shop's UPI id being a Google Pay or PhonePe handle is a
   * fact about its bank account and never an instruction to the customer.
   *
   * True adds one step before the QR: the customer picks an app from `manualUpiApps`, which is
   * sent as the order's `upiApp` and decides which of the store's ids the payment lands in.
   */
  manualUpiTokenVerificationEnabled?: boolean;
  /** The apps to offer, already filtered to what the merchant enabled. Empty unless the flag above
   *  is true — so never render a picker without checking the flag. */
  manualUpiApps?: UpiAppOption[];
  /** True when the customer may choose in-person pickup instead of shipping. */
  pickupEnabled?: boolean;
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
  /**
   * Whether this store takes bookings *right now* — the EFFECTIVE answer, already
   * combining the platform entitlement with the merchant's own switch. The whole
   * services surface (nav item, routes, home section) hangs off this one flag.
   *
   * Optional because a bundle can be live against a backend that predates the
   * field, and because a payload cached before a deploy will not carry it.
   * `undefined` therefore has to read as "off": a shop that cannot serve bookings
   * must never be offered them.
   */
  bookingsEnabled?: boolean;
  /** IANA zone the shop keeps its diary in ("Asia/Kolkata"). Opening hours and
   *  appointment times belong to the shop, never to the browser — see the
   *  formatters in lib/format.ts. */
  timezone?: string;
  /** Where customers physically come for an appointment; also the ICS location. */
  businessAddress?: string | null;
  /**
   * Which sections this shop actually has — `['CATALOG','SALES',...]`.
   *
   * Every storefront bundle ships every section; this list decides which of them
   * THIS shop shows. Read it through `useStoreFeatures()` rather than directly:
   * an absent list and an empty one mean opposite things (see lib/features.ts),
   * and getting that backwards empties a working shop or exposes a withdrawn one.
   *
   * It reports what is AVAILABLE, not merely granted — a store entitled to a
   * gateway with half its keys entered is absent from it.
   */
  features?: string[];
  /**
   * What this shop calls things: `{ products: 'cakes', category: 'occasion' }`.
   *
   * Every term resolved server-side — the merchant's word where they chose one,
   * the platform's default everywhere else. Read it through `useLexicon()`,
   * which supplies this bundle's own defaults for any key a deploy predates.
   */
  lexicon?: Record<string, string>;
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
  /** Platform entitlement: may this store offer Manual UPI at all. */
  manualUpiAllowed?: boolean;
  /** Merchant switch: has this store turned Manual UPI on. */
  manualUpiEnabled?: boolean;
  /** The store's DEFAULT UPI id — what an ordinary UPI payment is made to, from whatever app the
   *  customer uses. App-specific ids live in StoreUpiSettingsResponse. */
  manualUpiVpa?: string | null;
  /** Platform entitlement: may this store run token-based UPI verification. False means the whole
   *  multi-account/token area is not this store's to configure — hide it rather than showing a
   *  switch the server will refuse. */
  manualUpiTokenVerificationAllowed?: boolean;
  /** Merchant switch: whether direct UPI payments are verified by token. What the merchant saved,
   *  not necessarily what is in force. Set through the upi-settings endpoint, not the
   *  payment-settings card. */
  manualUpiTokenVerificationEnabled?: boolean;
  whatsappEnabled: boolean;
  /** Commerce rules (WP-P.6) — same figures the storefront reads from /store. */
  shippingFlatAmount?: number;
  freeShippingThreshold?: number | null;
  taxRatePercent?: number;
  pricesIncludeTax?: boolean;
  /** Whether a customer may choose in-person pickup instead of shipping. */
  pickupEnabled?: boolean;
  /** Storefront opening copy. `null` = the merchant has written none, so show the
   *  field empty with the default as placeholder rather than as a value. */
  heroEyebrow?: string | null;
  heroHeadline?: string | null;
  heroSubtext?: string | null;
  /**
   * The two booking flags, kept APART on purpose — the console has to tell the
   * merchant which of two very different situations they are in.
   *
   * `bookingsAllowed` is the platform entitlement: false means "not part of your
   * plan", which no switch in this console can change. `bookingsEnabled` is the
   * merchant's own switch, which they flip in booking settings. The storefront
   * only ever sees the AND of the two; collapsing them here would be the
   * difference between someone flipping a toggle and someone raising a ticket.
   */
  bookingsAllowed?: boolean;
  bookingsEnabled?: boolean;
  /** IANA zone; written through booking settings, read by every console screen
   *  that shows an appointment time. */
  timezone?: string;
  businessAddress?: string | null;
  /**
   * The sections this store has been GRANTED — the console builds its navigation
   * from this. Entitlements rather than effective capability, which is the same
   * distinction the two booking flags above draw: a store entitled to bookings
   * but not yet open for them still gets the setup pages, because that is how it
   * becomes ready to open.
   */
  features?: string[];
  /**
   * The merchant's OVERRIDES only — a term they have never renamed is absent
   * rather than filled in. That is what lets the rename form show the platform's
   * word as a placeholder and treat an empty box as "use the default", which is
   * the only way a merchant can undo a rename.
   */
  lexicon?: Record<string, string>;
  /** Every term the platform knows, at its default. The rename form is built
   *  from this, so a term added in a later release needs no console release. */
  lexiconDefaults?: Record<string, string>;
}

/**
 * `GET /api/v1/admin/store/features` (ADMIN **or STAFF**).
 *
 * The one part of a store's settings staff may read, and the reason it exists:
 * the rest of `/admin/store` is ADMIN-only, so a console gate that read its
 * entitlements from there had no answer for staff — and "no answer" has to mean
 * "nothing is gated" for older backends, which would have shown staff every
 * section regardless of what the store was granted.
 */
export interface StoreFeaturesResponse {
  features: string[];
}

/**
 * `PUT /api/v1/admin/store/lexicon` (ADMIN).
 *
 * FULL REPLACE: send every rename the store has, because a term left out reverts
 * to the platform default. Blank values are dropped server-side, so clearing a
 * box is how a merchant undoes one rename without touching the others.
 */
export interface UpdateStoreLexiconRequest {
  terms: Record<string, string>;
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
  /** Whether a customer may choose in-person pickup instead of shipping. Uses businessAddress as
   *  the pickup location. */
  pickupEnabled: boolean;
}

export interface UpdatePaymentSettingsRequest {
  codEnabled: boolean;
  onlinePaymentEnabled: boolean;
  razorpayKeyId?: string | null;
  razorpayKeySecret?: string | null;
  razorpayWebhookSecret?: string | null;
  manualUpiEnabled: boolean;
  /** Required when manualUpiEnabled is true; blank clears it. */
  manualUpiVpa?: string | null;
}

/** One configured UPI application and the id it is paid at. Admin-side — carries the handle. */
export interface StoreUpiConfigResponse {
  app: UpiApp;
  /** Display name for the app — render this rather than the enum name. */
  label: string;
  upiId: string;
  /** A disabled app is never offered to a customer and is refused if one selects it anyway. */
  enabled: boolean;
  sortOrder: number;
}

/** The store's UPI receiving configuration, as the merchant console sees it. */
export interface StoreUpiSettingsResponse {
  manualUpiEnabled: boolean;
  /** Where ordinary UPI payments land, whatever app the customer uses. */
  defaultUpiId: string | null;
  /** Platform entitlement. False means this store may not run token verification at all — the
   *  switch below cannot be turned on, and the server refuses it with
   *  `UPI_TOKEN_VERIFICATION_NOT_ALLOWED`. */
  tokenVerificationAllowed: boolean;
  /** The MERCHANT's switch — what they saved, which a withdrawn entitlement leaves untouched. */
  tokenVerificationEnabled: boolean;
  /** Effective: allowed AND enabled AND the store can take direct UPI. What customers actually
   *  meet at checkout, and what the storefront's own flag is derived from. */
  tokenVerificationInForce: boolean;
  /** Every configured application, enabled or not, in the merchant's own order. */
  configs: StoreUpiConfigResponse[];
}

export interface UpdateStoreUpiSettingsRequest {
  /** Enabling this requires at least one enabled application — the flow's first step is the
   *  customer choosing one, so the server refuses with UPI_APPS_NOT_CONFIGURED otherwise. */
  tokenVerificationEnabled: boolean;
  /** FULL REPLACE: an app left out is removed. `null` leaves the list untouched. */
  configs?: { app: UpiApp; upiId: string; enabled?: boolean }[] | null;
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

// ── Registering an address that already exists elsewhere on the platform ──
// Mirrors POST /api/v1/auth/register, which answers with EITHER shape:
//   201 → AuthResponse         brand-new account, signed in
//   202 → JoinPendingResponse  the address is already registered at another
//                              store; nothing is created until the emailed
//                              link is opened
// Branch on the STATUS CODE, exactly as login does. No tokens exist on the 202
// arm, so treating it as a session writes `undefined` over the token store.
export interface JoinPendingResponse {
  status: 'JOIN_VERIFICATION_SENT';
  message: string;
  /** DEV ONLY, same rules as {@link OtpChallengeResponse.otp}. */
  otp?: string | null;
}

/** Discriminated result of `register()` — the caller must handle both arms. */
export type RegisterResult =
  | { kind: 'session'; auth: AuthResponse }
  | { kind: 'joinPending'; pending: JoinPendingResponse };

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
  /**
   * REQUIRED since 2026-08-16 — omitting it is a 400.
   *
   * A request is routed to a store by the address it carries, so a store created
   * without one is unreachable: everything meant for it is answered by the
   * fallback store instead, with a 200 and the wrong catalogue. It is attached as
   * the store's primary address and grants the custom-domain entitlement in the
   * same call.
   *
   * A domain (`novasports.in`) or, while the shop's UI has no domain of its own,
   * a development address (`http://localhost:5180`). 409 DOMAIN_TAKEN if another
   * store already holds it — and then no store is created at all.
   */
  customDomain: string;
  /**
   * Further addresses the same shop answers on — a development server and a
   * production domain are one store, so both belong to it from the start.
   * Attached as non-primary; `customDomain` stays canonical. Each must be free,
   * or the whole creation is refused and no store is made.
   */
  additionalDomains?: string[] | null;
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

/**
 * Addresses are normalised server-side ("HTTPS://NovaSports.in/shop " →
 * "novasports.in"), so a pasted URL is accepted — show what was stored.
 *
 * Since 2026-08-16 a **port is kept** and a single-label host is allowed, so
 * "http://localhost:5180/" stores as "localhost:5180". That is what lets a store
 * be pointed at a UI with no domain yet, and — because the address index is
 * unique platform-wide — what lets two shops run side by side on one machine.
 * A default port for its scheme (`:443` on https) is dropped, since a browser
 * never sends one.
 *
 * Addresses are matched WHOLE: `amanly.in` and `tech.amanly.in` are unrelated and
 * may belong to different stores. Nothing walks up the domain tree.
 */
export interface AddStoreDomainRequest {
  hostname: string;
  makePrimary?: boolean;
}

/**
 * Re-points an existing mapping, keeping its id and primary flag — a shop moves
 * from a dev address to a preview deployment to its real domain.
 *
 * Preferred over remove-then-add, which is refused for the primary while other
 * domains remain (`409 CANNOT_REMOVE_PRIMARY_DOMAIN`).
 */
export interface UpdateStoreDomainRequest {
  hostname: string;
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
export type ErrorSource = 'HTTP' | 'SCHEDULED' | 'ASYNC' | 'EMAIL' | 'PLAN_LIMIT' | 'STORE_NOT_MAPPED';

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
  /** Draft for a category tile instead. Views are ignored.
   *  Superseded by `subject`; kept because the API still honours it. */
  forCategory?: boolean;
  /** What is being drawn. Decides the whole style of the prompt, not just its
   *  subject — a brand mark and a campaign banner need the opposite of the
   *  product-photography rules, which ban logos, people and props. Only
   *  `PRODUCT` has sides worth drafting separately. */
  subject?: PromptSubject;
}

export type PromptSubject = 'PRODUCT' | 'CATEGORY' | 'BRAND_LOGO' | 'BANNER';

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

// ── Services & bookings (WP-BU.0) ─────────────────────────────────────
// Mirrors com.royalcommerce.application.booking.dto.* and the service half of
// review.dto.*. The vertical is generic: any shop that sells appointments
// rather than (or as well as) goods. Nothing here is specific to a trade.
//
// Two rules govern this whole section, and both come from production incidents:
//
//  1. THE SERVER OWNS THE DIARY. Availability, opening hours, lead times and
//     cut-offs are computed on the backend under a per-store lock. The UI asks
//     what is free and offers exactly that back — it never derives a time.
//  2. TIMES BELONG TO THE SHOP. Instants are UTC on the wire and must be
//     rendered in the store's `timezone`, never the browser's. A customer three
//     zones away has to read the same clock face the shop does.

export type BookingStatus = 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
/** How the booking was made. Walk-ins and phone bookings are taken by staff in
 *  the console and may have no customer account behind them. */
export type BookingSource = 'ONLINE' | 'WALK_IN' | 'PHONE';
export type BookingCancelledBy = 'CUSTOMER' | 'STORE';

/** A bookable service as a customer sees it. No stock, no SKU, no cart —
 *  `durationMinutes` does the work a size or weight does in the product
 *  catalogue, and it is what shoppers actually compare on. */
export interface ServiceOfferingResponse {
  id: string;
  categoryId: string | null;
  categoryName: string | null;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  currency: string;
  durationMinutes: number;
  /** The first gallery image, repeated so a list can draw a thumbnail without
   *  reading the gallery. */
  imageUrl: string | null;
  imageAltText: string | null;
  /** Every picture, in the merchant's order. Optional: an older backend sends none. */
  images?: ServiceImageResponse[];
  /** Live average over APPROVED reviews, 1dp. `null` when there are none — show
   *  nothing rather than an empty five-star row. */
  ratingAvg: number | null;
  ratingCount: number;
}

/** The console's view: adds what a customer must not see or does not need. */
export interface AdminServiceOfferingResponse {
  id: string;
  categoryId: string | null;
  categoryName: string | null;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  currency: string;
  durationMinutes: number;
  /** Clean-up time blocked after each appointment. Deliberately invisible to the
   *  customer: their `endsAt` excludes it, but the diary counts it. */
  bufferMinutes: number;
  imageUrl: string | null;
  imageAltText: string | null;
  images?: ServiceImageResponse[];
  active: boolean;
  sortOrder: number;

  /**
   * Per-service rule overrides. **null means inherit the store's setting** — not
   * "no limit" — so a form must keep null and a number apart rather than
   * treating an empty box as zero.
   *
   * `maxConcurrentBookings` is the odd one: it is an ADDITIONAL ceiling rather
   * than a replacement, so a service can be scarcer than the shop but never more
   * plentiful. One laser machine in a two-chair salon.
   */
  minLeadTimeMinutes?: number | null;
  maxAdvanceDays?: number | null;
  maxConcurrentBookings?: number | null;
  cancellationCutoffHours?: number | null;
}

/** One picture of a service. Position is the array's own order — the first is the
 *  thumbnail shown wherever only one fits. */
export interface ServiceImageResponse {
  id: string;
  url: string;
  altText: string | null;
}

export interface ServiceImageRequest {
  url: string;
  altText?: string | null;
}

/** Service categories are a FLAT list, not the product category tree. */
export interface ServiceCategoryResponse {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  active: boolean;
  /** Who works in this group. **Empty means anyone** — a group nobody has been
   *  assigned to still offers the whole team, because an empty picker reads as a
   *  service that cannot be booked. */
  staffProfileIds?: string[];
}

export interface CreateServiceCategoryRequest {
  name: string;
  slug: string;
  sortOrder?: number;
  active?: boolean;
  staffProfileIds?: string[] | null;
}

/** Update is a full replace: `sortOrder` and `active` are required, so the edit
 *  form has to send back the values it loaded rather than only what changed. */
export interface UpdateServiceCategoryRequest {
  name: string;
  slug: string;
  sortOrder: number;
  active: boolean;
  /** Full replace, like the rest of this payload. */
  staffProfileIds?: string[] | null;
}

export interface CreateServiceOfferingRequest {
  categoryId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  price: number;
  /** 5..480 */
  durationMinutes: number;
  /** 0..120; omitted means 0. */
  bufferMinutes?: number;
  imageUrl?: string | null;
  imageAltText?: string | null;
  active?: boolean;
  sortOrder?: number;
  minLeadTimeMinutes?: number | null;
  maxAdvanceDays?: number | null;
  maxConcurrentBookings?: number | null;
  cancellationCutoffHours?: number | null;
  /** The gallery in display order; the first becomes the thumbnail. */
  images?: ServiceImageRequest[] | null;
}

/** Full replace — unlike the create form, `bufferMinutes`, `active` and
 *  `sortOrder` are mandatory here. Load, edit, send everything back. */
export interface UpdateServiceOfferingRequest {
  categoryId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  price: number;
  durationMinutes: number;
  bufferMinutes: number;
  imageUrl?: string | null;
  imageAltText?: string | null;
  active: boolean;
  sortOrder: number;
  minLeadTimeMinutes?: number | null;
  maxAdvanceDays?: number | null;
  maxConcurrentBookings?: number | null;
  cancellationCutoffHours?: number | null;
  /** Null leaves the existing pictures alone; an empty array clears them. */
  images?: ServiceImageRequest[] | null;
}

/** A practitioner as a customer sees them. Nothing links staff to services in
 *  this version, so a picker can only offer "everyone who takes appointments",
 *  never "who can do this one". */
export interface PublicStaffResponse {
  id: string;
  displayName: string;
  title: string | null;
  bio: string | null;
  photoUrl: string | null;
}

export interface StaffProfileResponse {
  id: string;
  /** Linked login, when this person also signs into the console. */
  userId: string | null;
  displayName: string;
  title: string | null;
  bio: string | null;
  photoUrl: string | null;
  active: boolean;
  sortOrder: number;
}

export interface SaveStaffProfileRequest {
  userId?: string | null;
  displayName: string;
  title?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
  active?: boolean;
  sortOrder?: number;
}

/**
 * One offered start time.
 *
 * `startsAt` is the contract: send this exact string back when booking. Parsing
 * it into a Date and re-serialising yields an equal instant in a different
 * spelling, and the server refuses times it did not offer (400
 * BOOKING_OUTSIDE_RULES). `endsAt` covers the service only — the clean-up buffer
 * is deliberately not exposed. `localTime` is a pre-rendered "14:30" in the
 * shop's zone, which is why a picker needs no timezone library.
 */
export interface AvailabilitySlot {
  startsAt: string;
  endsAt: string;
  localTime: string;
}

/**
 * What is free on one day.
 *
 * An EMPTY `slots` array is a normal, successful answer: closed that day, fully
 * booked, a past date, or beyond the booking window. It is never an error and
 * must never be rendered as one.
 */
export interface AvailabilityResponse {
  date: string;
  timezone: string;
  slots: AvailabilitySlot[];
}

/** A customer's booking. There are no payment fields at all — booking is free
 *  and the customer pays at the venue. */
export interface BookingResponse {
  id: string;
  /** "BKG-XXXXXXXX" — the reference a customer quotes on the phone. */
  bookingNumber: string;
  serviceOfferingId: string;
  /** Snapshot taken when the booking was made: later menu edits never move a
   *  price that has already been promised. */
  serviceName: string;
  price: number;
  currency: string;
  durationMinutes: number;
  staffProfileId: string | null;
  /** Joined at read time and nullable — assignment can change after booking. */
  staffName: string | null;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  source: BookingSource;
  customerName: string;
  customerPhone: string | null;
  notes: string | null;
  cancellationReason: string | null;
  /** Prebuilt calendar.google.com template link. Needs no authentication, so it
   *  is a plain anchor — unlike the .ics route, which carries the bearer token. */
  googleCalendarUrl: string;
}

/** The console's view. `internalNote` is staff-only and must never reach a
 *  customer-facing screen. */
export interface AdminBookingResponse extends BookingResponse {
  bufferMinutes: number;
  /** null for walk-ins and phone bookings — those customers have no account. */
  customerUserId: string | null;
  customerEmail: string | null;
  internalNote: string | null;
  cancelledAt: string | null;
  cancelledBy: BookingCancelledBy | null;
}

/** Name and email are snapshotted from the account server-side — don't send them. */
export interface PlaceBookingRequest {
  serviceOfferingId: string;
  /** The offered slot's `startsAt`, byte for byte. */
  startsAt: string;
  /** Omitted or null = "anyone available", which yields more times. */
  staffProfileId?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
}

/** Staff-created booking. `customerName` is required precisely because there may
 *  be no account; `source` must be WALK_IN or PHONE (ONLINE is rejected).
 *  Walk-ins skip the lead-time and advance-window rules but NEVER the clash
 *  check — a double booking is still a 409. */
export interface CreateWalkInBookingRequest {
  serviceOfferingId: string;
  startsAt: string;
  staffProfileId?: string | null;
  source: Exclude<BookingSource, 'ONLINE'>;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  notes?: string | null;
  internalNote?: string | null;
}

/** Moves the booking IN PLACE: same row, same id, same booking number, and the
 *  calendar entry the customer already added updates instead of duplicating. */
export interface RescheduleBookingRequest {
  newStartsAt: string;
}

export interface CancelBookingRequest {
  reason?: string | null;
}

/** null unassigns. */
export interface AssignStaffRequest {
  staffProfileId: string | null;
}

/** A booking can never be put BACK to CONFIRMED, and COMPLETED / NO_SHOW are
 *  refused until the appointment's start time has passed. */
export interface BookingStatusChangeRequest {
  status: Exclude<BookingStatus, 'CONFIRMED'>;
  reason?: string | null;
}

/**
 * One day's opening hours.
 *
 * `weekday` is ISO-8601 — 1 = Monday … 7 = Sunday. NOT JavaScript's
 * `Date.getDay()`, which is 0 = Sunday. A weekday missing from the list means
 * CLOSED; there is no flag for it.
 */
export interface BusinessHoursEntry {
  weekday: number;
  /** Wall clock in the store's zone, "09:30". */
  openTime: string;
  closeTime: string;
}

export interface PublicBusinessHoursResponse {
  timezone: string;
  businessHours: BusinessHoursEntry[];
}

/**
 * Everything that governs the diary, in one payload (ADMIN only).
 *
 * A store that has never saved settings reads back DEFAULTS rather than a 404 —
 * with an empty `businessHours`, which means closed every day. That is why a
 * half-configured shop shows "no times" instead of breaking.
 */
export interface BookingSettingsResponse {
  /** Platform entitlement — read-only here. */
  bookingsAllowed: boolean;
  bookingsEnabled: boolean;
  timezone: string;
  businessAddress: string | null;
  slotGranularityMinutes: number;
  /** How many appointments may run at once ("chairs"). */
  maxConcurrentBookings: number;
  minLeadTimeMinutes: number;
  maxAdvanceDays: number;
  cancellationCutoffHours: number;
  /** null = that reminder is off. The second must be closer than the first. */
  reminderHoursBeforeFirst: number | null;
  reminderHoursBeforeSecond: number | null;
  /** WhatsApp stays silent until these name templates Meta has approved. */
  whatsappConfirmationTemplate: string | null;
  whatsappReminderTemplate: string | null;
  businessHours: BusinessHoursEntry[];
}

/**
 * FULL REPLACE — including `businessHours`, which is deleted and re-inserted.
 *
 * Every field below is required by the server; there is no "null means keep what
 * you had". A form that submits before its GET resolves would close the shop for
 * the week, so submission must stay blocked until the current settings load.
 */
export interface UpdateBookingSettingsRequest {
  bookingsEnabled: boolean;
  /** IANA id; validated with ZoneId.of, so a bad string is a 400. */
  timezone: string;
  businessAddress?: string | null;
  /** 5..120 */
  slotGranularityMinutes: number;
  /** 1..100 */
  maxConcurrentBookings: number;
  /** 0..10080 */
  minLeadTimeMinutes: number;
  /** 1..365 */
  maxAdvanceDays: number;
  /** 0..336 */
  cancellationCutoffHours: number;
  /** 1..168, or null to switch off. */
  reminderHoursBeforeFirst?: number | null;
  reminderHoursBeforeSecond?: number | null;
  whatsappConfirmationTemplate?: string | null;
  whatsappReminderTemplate?: string | null;
  /** An empty list closes the shop every day of the week. */
  businessHours: BusinessHoursEntry[];
}

/**
 * My review of a service, plus whether I may write one.
 *
 * Deliberately the same shape as {@link MyReviewResponse} except for the
 * eligibility field: a service review is earned by a COMPLETED appointment
 * (`booked`) where a product review is earned by a delivered order
 * (`purchased`). That one word is the only reason this interface exists.
 */
export interface MyServiceReviewResponse {
  booked: boolean;
  canReview: boolean;
  review: MyReview | null;
}

/** Moderation queue row (ADMIN/STAFF). Note `verifiedBooking` where the product
 *  equivalent says `verifiedPurchase`. */
export interface AdminServiceReviewResponse {
  id: string;
  serviceOfferingId: string;
  userId: string;
  reviewerName: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: ReviewStatus;
  verifiedBooking: boolean;
  createdAt: string;
  updatedAt: string;
}
