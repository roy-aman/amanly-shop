import { buildQuery, request } from '@/lib/http';
import type {
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
export function listCategories(): Promise<CategoryResponse[]> {
  return request('GET', '/api/v1/categories');
}
export function getCategoryTree(): Promise<CategoryTreeResponse[]> {
  return request('GET', '/api/v1/categories/tree');
}
export function getCategory(slug: string): Promise<CategoryResponse> {
  return request('GET', `/api/v1/categories/${encodeURIComponent(slug)}`);
}
