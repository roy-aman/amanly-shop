import { buildQuery, request } from '@/lib/http';
import type {
  LowStockProduct,
  RevenueGranularity,
  RevenueSeriesResponse,
  StatsOverviewResponse,
  TopProductStat,
} from '@/lib/types';

const S = '/api/v1/admin/stats';

// ── Admin analytics (ADMIN, STAFF) ────────────────────────────────────
// Dates are yyyy-MM-dd, inclusive; both optional (backend defaults to the
// trailing 30 days). Real WP-3.1a endpoints — no client-side aggregation.
export interface StatsRangeParams {
  from?: string;
  to?: string;
}

export const adminStats = {
  overview(params: StatsRangeParams = {}): Promise<StatsOverviewResponse> {
    return request('GET', `${S}/overview${buildQuery(params as Record<string, unknown>)}`, { auth: true });
  },
  revenueSeries(
    params: StatsRangeParams & { granularity?: RevenueGranularity } = {},
  ): Promise<RevenueSeriesResponse> {
    return request('GET', `${S}/revenue-series${buildQuery(params as Record<string, unknown>)}`, { auth: true });
  },
  topProducts(params: StatsRangeParams & { limit?: number } = {}): Promise<TopProductStat[]> {
    return request('GET', `${S}/top-products${buildQuery(params as Record<string, unknown>)}`, { auth: true });
  },
  lowStock(params: { threshold?: number; limit?: number } = {}): Promise<LowStockProduct[]> {
    return request('GET', `${S}/low-stock${buildQuery(params as Record<string, unknown>)}`, { auth: true });
  },
};
