import { buildQuery, request } from '@/lib/http';
import type {
  AdminCouponResponse,
  AdminCreateUserRequest,
  AdminReviewResponse,
  BrandResponse,
  CategoryResponse,
  ChangeUserRolesRequest,
  CreateBrandRequest,
  CreateCategoryRequest,
  CreateCouponRequest,
  CreateProductRequest,
  CreateVariantRequest,
  OrderPaymentStatus,
  OrderResponse,
  OrderStatus,
  OrderSummaryResponse,
  Page,
  ProductImageRequest,
  ProductResponse,
  ProductSearchParams,
  ProductStatus,
  ProductSummaryResponse,
  ProductVariantResponse,
  ReviewStatus,
  StoreSettingsResponse,
  UpdateBrandRequest,
  UpdateCategoryRequest,
  UpdateCouponRequest,
  UpdatePaymentSettingsRequest,
  UpdateProductRequest,
  UpdateVariantRequest,
  UpdateCommerceSettingsRequest,
  UpdateWhatsappSettingsRequest,
  UserResponse,
} from '@/lib/types';

const A = '/api/v1/admin';

// ── Products / inventory (ADMIN, STAFF) ───────────────────────────────
export const adminProducts = {
  list(params: ProductSearchParams = {}): Promise<Page<ProductSummaryResponse>> {
    return request('GET', `${A}/products${buildQuery(params as Record<string, unknown>)}`, { auth: true });
  },
  get(id: string): Promise<ProductResponse> {
    return request('GET', `${A}/products/${id}`, { auth: true });
  },
  create(body: CreateProductRequest): Promise<ProductResponse> {
    return request('POST', `${A}/products`, { body, auth: true });
  },
  update(id: string, body: UpdateProductRequest): Promise<ProductResponse> {
    return request('PUT', `${A}/products/${id}`, { body, auth: true });
  },
  changeStatus(id: string, status: ProductStatus): Promise<ProductResponse> {
    return request('PATCH', `${A}/products/${id}/status`, { body: { status }, auth: true });
  },
  setStock(id: string, quantity: number): Promise<ProductResponse> {
    return request('PATCH', `${A}/products/${id}/stock`, { body: { quantity }, auth: true });
  },
  addImages(id: string, images: ProductImageRequest[]): Promise<ProductResponse> {
    return request('POST', `${A}/products/${id}/images`, { body: images, auth: true });
  },
  /** Promotes an existing image to the listing thumbnail; the incumbent is demoted for you. */
  setPrimaryImage(id: string, imageId: string): Promise<ProductResponse> {
    return request('PATCH', `${A}/products/${id}/images/${imageId}/primary`, { auth: true });
  },
  deleteImage(id: string, imageId: string): Promise<ProductResponse> {
    return request('DELETE', `${A}/products/${id}/images/${imageId}`, { auth: true });
  },
  remove(id: string): Promise<void> {
    return request('DELETE', `${A}/products/${id}`, { auth: true }); // ADMIN only
  },
};

// ── Product variants (ADMIN, STAFF) ───────────────────────────────────
// Scoped under a product: /admin/products/{productId}/variants. SKU is immutable
// on update; stock is set via the dedicated PATCH .../stock endpoint. The first
// active variant makes the product variant-based (add-to-cart then requires a
// variantId). 409 VARIANT_SKU_EXISTS / VARIANT_OPTIONS_EXISTS on a collision.
export const adminProductVariants = {
  list(productId: string): Promise<ProductVariantResponse[]> {
    return request('GET', `${A}/products/${productId}/variants`, { auth: true });
  },
  create(productId: string, body: CreateVariantRequest): Promise<ProductVariantResponse> {
    return request('POST', `${A}/products/${productId}/variants`, { body, auth: true });
  },
  update(productId: string, variantId: string, body: UpdateVariantRequest): Promise<ProductVariantResponse> {
    return request('PUT', `${A}/products/${productId}/variants/${variantId}`, { body, auth: true });
  },
  setStock(productId: string, variantId: string, quantity: number): Promise<ProductVariantResponse> {
    return request('PATCH', `${A}/products/${productId}/variants/${variantId}/stock`, {
      body: { quantity },
      auth: true,
    });
  },
  remove(productId: string, variantId: string): Promise<void> {
    return request('DELETE', `${A}/products/${productId}/variants/${variantId}`, { auth: true });
  },
};

// ── Brands (ADMIN, STAFF; no delete — deactivate only) ────────────────
export const adminBrands = {
  list(): Promise<BrandResponse[]> {
    return request('GET', `${A}/brands`, { auth: true });
  },
  get(id: string): Promise<BrandResponse> {
    return request('GET', `${A}/brands/${id}`, { auth: true });
  },
  create(body: CreateBrandRequest): Promise<BrandResponse> {
    return request('POST', `${A}/brands`, { body, auth: true });
  },
  update(id: string, body: UpdateBrandRequest): Promise<BrandResponse> {
    return request('PUT', `${A}/brands/${id}`, { body, auth: true });
  },
  deactivate(id: string): Promise<BrandResponse> {
    return request('POST', `${A}/brands/${id}/deactivate`, { auth: true });
  },
};

// ── Categories (ADMIN, STAFF; delete ADMIN only) ──────────────────────
export const adminCategories = {
  list(): Promise<CategoryResponse[]> {
    return request('GET', `${A}/categories`, { auth: true });
  },
  create(body: CreateCategoryRequest): Promise<CategoryResponse> {
    return request('POST', `${A}/categories`, { body, auth: true });
  },
  update(id: string, body: UpdateCategoryRequest): Promise<CategoryResponse> {
    return request('PUT', `${A}/categories/${id}`, { body, auth: true });
  },
  remove(id: string): Promise<void> {
    return request('DELETE', `${A}/categories/${id}`, { auth: true });
  },
};

// ── Orders (ADMIN, STAFF) ─────────────────────────────────────────────
export interface AdminOrderListParams {
  page?: number;
  size?: number;
  sort?: string;
  status?: OrderStatus;
  paymentStatus?: OrderPaymentStatus;
  userId?: string;
  dateFrom?: string; // ISO date (yyyy-MM-dd)
  dateTo?: string; // ISO date (yyyy-MM-dd), inclusive
  search?: string;
}

export const adminOrders = {
  list(params: AdminOrderListParams = {}): Promise<Page<OrderSummaryResponse>> {
    return request('GET', `${A}/orders${buildQuery(params as Record<string, unknown>)}`, { auth: true });
  },
  get(id: string): Promise<OrderResponse> {
    return request('GET', `${A}/orders/${id}`, { auth: true });
  },
  updateStatus(id: string, status: OrderStatus): Promise<OrderResponse> {
    return request('PATCH', `${A}/orders/${id}/status`, { body: { status }, auth: true });
  },
  updatePaymentStatus(id: string, paymentStatus: OrderPaymentStatus): Promise<OrderResponse> {
    return request('PATCH', `${A}/orders/${id}/payment-status`, { body: { paymentStatus }, auth: true });
  },
};

// ── Users / teams (ADMIN only) ────────────────────────────────────────
export const adminUsers = {
  list(params: { search?: string; page?: number; size?: number; sort?: string } = {}): Promise<Page<UserResponse>> {
    return request('GET', `${A}/users${buildQuery(params)}`, { auth: true });
  },
  get(id: string): Promise<UserResponse> {
    return request('GET', `${A}/users/${id}`, { auth: true });
  },
  create(body: AdminCreateUserRequest): Promise<UserResponse> {
    return request('POST', `${A}/users`, { body, auth: true });
  },
  changeRoles(id: string, roles: ChangeUserRolesRequest['roles']): Promise<UserResponse> {
    return request('PATCH', `${A}/users/${id}/roles`, { body: { roles }, auth: true });
  },
  lock(id: string, reason?: string): Promise<UserResponse> {
    return request('PATCH', `${A}/users/${id}/lock`, { body: { reason: reason ?? null }, auth: true });
  },
  unlock(id: string): Promise<UserResponse> {
    return request('PATCH', `${A}/users/${id}/unlock`, { auth: true });
  },
  enable(id: string): Promise<UserResponse> {
    return request('PATCH', `${A}/users/${id}/enable`, { auth: true });
  },
  disable(id: string, reason?: string): Promise<UserResponse> {
    return request('PATCH', `${A}/users/${id}/disable`, { body: { reason: reason ?? null }, auth: true });
  },
};

// ── Review moderation (ADMIN, STAFF) ──────────────────────────────────
export const adminReviews = {
  list(params: { status?: ReviewStatus; page?: number; size?: number } = {}): Promise<Page<AdminReviewResponse>> {
    return request('GET', `${A}/reviews${buildQuery(params as Record<string, unknown>)}`, { auth: true });
  },
  approve(id: string): Promise<AdminReviewResponse> {
    return request('POST', `${A}/reviews/${id}/approve`, { auth: true });
  },
  reject(id: string): Promise<AdminReviewResponse> {
    return request('POST', `${A}/reviews/${id}/reject`, { auth: true });
  },
};

// ── Coupons (ADMIN, STAFF; delete ADMIN only) ─────────────────────────
export const adminCoupons = {
  list(params: { page?: number; size?: number; sort?: string } = {}): Promise<Page<AdminCouponResponse>> {
    return request('GET', `${A}/coupons${buildQuery(params)}`, { auth: true });
  },
  get(id: string): Promise<AdminCouponResponse> {
    return request('GET', `${A}/coupons/${id}`, { auth: true });
  },
  create(body: CreateCouponRequest): Promise<AdminCouponResponse> {
    return request('POST', `${A}/coupons`, { body, auth: true });
  },
  update(id: string, body: UpdateCouponRequest): Promise<AdminCouponResponse> {
    return request('PUT', `${A}/coupons/${id}`, { body, auth: true });
  },
  deactivate(id: string): Promise<AdminCouponResponse> {
    return request('POST', `${A}/coupons/${id}/deactivate`, { auth: true });
  },
  // ADMIN only. 409 COUPON_HAS_REDEMPTIONS when the coupon has been used → deactivate instead.
  remove(id: string): Promise<void> {
    return request('DELETE', `${A}/coupons/${id}`, { auth: true });
  },
};

// ── Store settings (ADMIN only) ───────────────────────────────────────
export const adminStore = {
  get(): Promise<StoreSettingsResponse> {
    return request('GET', `${A}/store`, { auth: true });
  },
  updatePayment(body: UpdatePaymentSettingsRequest): Promise<StoreSettingsResponse> {
    return request('PUT', `${A}/store/payment-settings`, { body, auth: true });
  },
  updateWhatsapp(body: UpdateWhatsappSettingsRequest): Promise<StoreSettingsResponse> {
    return request('PUT', `${A}/store/whatsapp-settings`, { body, auth: true });
  },
  /** Shipping and tax rules (WP-P.6). Applies to FUTURE orders only — placed
   *  orders keep the figures snapshotted at placement. Every field is applied
   *  as sent, so submit the loaded values, not a partial patch. */
  updateCommerce(body: UpdateCommerceSettingsRequest): Promise<StoreSettingsResponse> {
    return request('PUT', `${A}/store/commerce-settings`, { body, auth: true });
  },
};
