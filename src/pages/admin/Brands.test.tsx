import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import Brands from './Brands';
import { adminBrands } from '@/api/admin';
import type { BrandResponse } from '@/lib/types';

vi.mock('@/api/admin', () => ({
  adminBrands: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), deactivate: vi.fn() },
}));
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), push: vi.fn() }),
}));

const listMock = vi.mocked(adminBrands.list);
const createMock = vi.mocked(adminBrands.create);

function brand(overrides: Partial<BrandResponse> = {}): BrandResponse {
  return {
    id: 'b1',
    name: 'Royal Textiles',
    slug: 'royal-textiles',
    description: 'Premium fabrics',
    logoUrl: null,
    active: true,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  listMock.mockResolvedValue([brand()]);
  createMock.mockResolvedValue(brand());
});

describe('Admin Brands', () => {
  it('lists brands with name and slug', async () => {
    renderWithProviders(<Brands />);
    expect(await screen.findByText('Royal Textiles')).toBeInTheDocument();
    expect(screen.getByText('royal-textiles')).toBeInTheDocument();
  });

  it('shows an empty state when there are no brands', async () => {
    listMock.mockResolvedValue([]);
    renderWithProviders(<Brands />);
    expect(await screen.findByText('No brands yet')).toBeInTheDocument();
  });

  it('creates a brand, auto-suggesting the slug from the name', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Brands />);
    await screen.findByText('Royal Textiles');

    await user.click(screen.getByRole('button', { name: /new brand/i }));
    await user.type(screen.getByPlaceholderText('Royal Textiles'), 'Acme Co');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Acme Co', slug: 'acme-co', active: true }),
      ),
    );
  });
});
