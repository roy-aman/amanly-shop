import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import Coupons from './Coupons';
import { adminCoupons } from '@/api/admin';
import { getPublicStore } from '@/api/store';
import type { AdminCouponResponse, Page } from '@/lib/types';

vi.mock('@/api/admin', () => ({
  adminCoupons: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), deactivate: vi.fn(), remove: vi.fn() },
}));
vi.mock('@/api/store', () => ({ getPublicStore: vi.fn() }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ isAdmin: true }) }));
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), push: vi.fn() }),
}));

const listMock = vi.mocked(adminCoupons.list);
const createMock = vi.mocked(adminCoupons.create);
const storeMock = vi.mocked(getPublicStore);

function coupon(overrides: Partial<AdminCouponResponse> = {}): AdminCouponResponse {
  return {
    id: 'cp1',
    code: 'WELCOME10',
    type: 'PERCENT',
    value: 10,
    minOrderAmount: null,
    startsAt: null,
    endsAt: null,
    maxRedemptions: 100,
    perUserLimit: 1,
    active: true,
    totalRedemptions: 4,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    ...overrides,
  };
}

function page(content: AdminCouponResponse[]): Page<AdminCouponResponse> {
  return {
    content,
    totalElements: content.length,
    totalPages: 1,
    number: 0,
    size: 20,
    first: true,
    last: true,
    numberOfElements: content.length,
    empty: content.length === 0,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  storeMock.mockResolvedValue({ slug: 'royal', name: 'Royal', currency: 'USD', codEnabled: true, onlinePaymentEnabled: true });
  listMock.mockResolvedValue(page([coupon()]));
  createMock.mockResolvedValue(coupon());
});

describe('Admin Coupons', () => {
  it('lists coupons with code and redemption counts', async () => {
    renderWithProviders(<Coupons />);
    expect(await screen.findByText('WELCOME10')).toBeInTheDocument();
    expect(screen.getByText(/4 \/ 100/)).toBeInTheDocument();
    expect(listMock).toHaveBeenCalledWith({ page: 0, size: 20 });
  });

  it('shows an empty state when there are no coupons', async () => {
    listMock.mockResolvedValue(page([]));
    renderWithProviders(<Coupons />);
    expect(await screen.findByText('No coupons yet')).toBeInTheDocument();
  });

  it('creates a coupon from the form', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Coupons />);
    await screen.findByText('WELCOME10');

    await user.click(screen.getByRole('button', { name: /new coupon/i }));
    // Field labels are visual-only (not htmlFor-associated), so query by placeholder/role.
    await user.type(screen.getByPlaceholderText('WELCOME10'), 'SUMMER20');
    await user.type(screen.getAllByRole('spinbutton')[0], '20'); // first number field = Value
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'SUMMER20', type: 'PERCENT', value: 20, active: true }),
      ),
    );
  });
});
