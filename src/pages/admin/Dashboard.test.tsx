import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import Dashboard from './Dashboard';
import { adminStats } from '@/api/stats';
import { adminOrders } from '@/api/admin';
import { getPublicStore } from '@/api/store';
import type { Page, OrderSummaryResponse, StatsOverviewResponse } from '@/lib/types';

vi.mock('@/api/stats', () => ({
  adminStats: { overview: vi.fn(), revenueSeries: vi.fn(), topProducts: vi.fn(), lowStock: vi.fn() },
}));
vi.mock('@/api/admin', () => ({ adminOrders: { list: vi.fn() } }));
vi.mock('@/api/store', () => ({ getPublicStore: vi.fn() }));

const overview = vi.mocked(adminStats.overview);
const revenueSeries = vi.mocked(adminStats.revenueSeries);
const topProducts = vi.mocked(adminStats.topProducts);
const lowStock = vi.mocked(adminStats.lowStock);
const ordersList = vi.mocked(adminOrders.list);
const store = vi.mocked(getPublicStore);

// Revenue.changePct is deliberately null (previous period was 0) → the tile must
// render "—", never "0"; paid-orders carries a real +12.5% delta.
function overviewData(): StatsOverviewResponse {
  return {
    from: '2026-06-16',
    to: '2026-07-15',
    revenue: { current: 1234.5, previous: 0, changePct: null },
    paidOrders: { current: 20, previous: 16, changePct: 12.5 },
    totalOrders: { current: 25, previous: 20, changePct: 25 },
    customers: { current: 8, previous: 10, changePct: -20 },
    averageOrderValue: { current: 61.72, previous: 55, changePct: 12.2 },
    ordersByStatus: { PENDING: 3, PROCESSING: 2, SHIPPED: 4, DELIVERED: 15, CANCELLED: 1 },
  };
}

function emptyOrders(): Page<OrderSummaryResponse> {
  return {
    content: [], totalElements: 0, totalPages: 0, number: 0, size: 8,
    first: true, last: true, numberOfElements: 0, empty: true,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  store.mockResolvedValue({ slug: 'royal', name: 'Royal Test', currency: 'USD', codEnabled: true, onlinePaymentEnabled: true });
  overview.mockResolvedValue(overviewData());
  revenueSeries.mockResolvedValue({ from: '2026-06-16', to: '2026-07-15', granularity: 'DAY', points: [] });
  topProducts.mockResolvedValue([]);
  lowStock.mockResolvedValue([]);
  ordersList.mockResolvedValue(emptyOrders());
});

describe('Dashboard', () => {
  it('renders KPI tiles from the stats overview endpoint', async () => {
    renderWithProviders(<Dashboard />);
    // Revenue value formatted in the store currency.
    expect(await screen.findByText('$1,234.50')).toBeInTheDocument();
    expect(screen.getByText('Paid orders')).toBeInTheDocument();
    expect(screen.getByText('Customers')).toBeInTheDocument();
    expect(screen.getByText('Avg. order value')).toBeInTheDocument();
  });

  it('renders "—" for a null changePct instead of a zero delta', async () => {
    renderWithProviders(<Dashboard />);
    // Revenue's changePct is null → explicit em-dash hint, and no "+0%"/"0%" badge.
    expect(await screen.findByText('— vs. previous period')).toBeInTheDocument();
  });

  it('renders a positive delta badge for a non-null changePct', async () => {
    renderWithProviders(<Dashboard />);
    await screen.findByText('$1,234.50');
    // "+12.5%" is split across text nodes inside the delta span → match by textContent.
    const badge = screen.getByText((_, el) => el?.textContent === '+12.5%' && el.tagName === 'SPAN');
    expect(badge).toBeInTheDocument();
  });

  it('falls back to empty states when there are no top products or low stock', async () => {
    renderWithProviders(<Dashboard />);
    expect(await screen.findByText('No sales yet')).toBeInTheDocument();
    expect(screen.getByText('Stock looks healthy')).toBeInTheDocument();
  });
});
