import { buildQuery, request } from '@/lib/http';
import type {
  BrandResponse,
  CategoryResponse,
  CategoryTreeResponse,
  Page,
  ProductResponse,
  ProductSearchParams,
  ProductSummaryResponse,
} from '@/lib/types';

// ── Public catalog ────────────────────────────────────────────────────
export function listProducts(params: ProductSearchParams = {}): Promise<Page<ProductSummaryResponse>> {
  return request('GET', `/api/v1/products${buildQuery(params as Record<string, unknown>)}`);
}
export function getProduct(slug: string): Promise<ProductResponse> {
  return request('GET', `/api/v1/products/${encodeURIComponent(slug)}`);
}
/**
 * Best-sellers: active products ranked by units sold across paid orders (public,
 * WP-3.1a). Returns `[]` when nothing has sold yet. CAVEAT: this does NOT compose
 * with the PLP's price/stock/search filters or pagination — use it only for the
 * standalone best-sellers rail, not the filtered product listing.
 */
export function getTopProducts(params: { categoryId?: string; limit?: number } = {}): Promise<ProductSummaryResponse[]> {
  return request('GET', `/api/v1/products/top${buildQuery(params as Record<string, unknown>)}`);
}
export function listCategories(): Promise<CategoryResponse[]> {
  return request('GET', '/api/v1/categories');
}
export function getCategoryTree(): Promise<CategoryTreeResponse[]> {
  return request('GET', '/api/v1/categories/tree');
}
export function getCategory(slug: string): Promise<CategoryResponse> {
  return request('GET', `/api/v1/categories/${encodeURIComponent(slug)}`);
}
/** Active brands for the storefront brand filter (public, WP-3.5), ordered by name. */
export function listBrands(): Promise<BrandResponse[]> {
  return request('GET', '/api/v1/brands');
}
