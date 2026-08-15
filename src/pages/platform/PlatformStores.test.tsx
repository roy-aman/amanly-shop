import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import PlatformStores from './PlatformStores';
import { platformStores } from '@/api/platform';
import { ApiError } from '@/lib/http';
import type { StoreAdminSummaryResponse } from '@/lib/types';

vi.mock('@/api/platform', () => ({
  platformStores: { list: vi.fn(), create: vi.fn(), get: vi.fn(), update: vi.fn(), updateEntitlements: vi.fn() },
}));
const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), push: vi.fn() };
vi.mock('@/context/ToastContext', () => ({ useToast: () => toast }));

const listMock = vi.mocked(platformStores.list);
const createMock = vi.mocked(platformStores.create);

function store(overrides: Partial<StoreAdminSummaryResponse> = {}): StoreAdminSummaryResponse {
  return {
    id: 'store-1',
    slug: 'nova',
    name: 'Nova Sports',
    status: 'ACTIVE',
    currency: 'INR',
    codEnabled: true,
    onlinePaymentConfigured: true,
    whatsappConfigured: false,
    onlinePaymentsAllowed: true,
    whatsappNotificationsAllowed: true,
    whatsappCommerceAllowed: false,
    emailNotificationsAllowed: true,
    marketingEmailAllowed: false,
    customDomainAllowed: true,
    imageUploadAllowed: false,
    aiImageGenerationAllowed: false,
    bookingsAllowed: false,
    maxStaffSeats: 5,
    maxImageUploads: null,
    maxAiImageGenerations: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  listMock.mockResolvedValue([store()]);
  createMock.mockResolvedValue(store({ id: 'store-2', slug: 'acme', name: 'Acme Co' }));
});

describe('Platform stores list', () => {
  it('lists every shop with its trading status', async () => {
    listMock.mockResolvedValue([store(), store({ id: 's2', slug: 'closed', name: 'Closed Co', status: 'CLOSED' })]);
    renderWithProviders(<PlatformStores />);

    expect(await screen.findByText('Nova Sports')).toBeInTheDocument();
    expect(screen.getByText('CLOSED')).toBeInTheDocument();
  });

  it('separates "the platform allows it" from "the merchant set it up"', async () => {
    listMock.mockResolvedValue([store({ onlinePaymentsAllowed: true, onlinePaymentConfigured: false })]);
    renderWithProviders(<PlatformStores />);
    await screen.findByText('Nova Sports');

    // The half that is missing is the whole question when debugging "why can't
    // they take payments".
    expect(screen.getAllByText('Allowed · not set up').length).toBeGreaterThan(0);
  });

  it('says "Not allowed" when the platform withheld the capability', async () => {
    listMock.mockResolvedValue([store({ onlinePaymentsAllowed: false, onlinePaymentConfigured: false })]);
    renderWithProviders(<PlatformStores />);
    await screen.findByText('Nova Sports');
    expect(screen.getAllByText('Not allowed').length).toBeGreaterThan(0);
  });

  it('refuses an admin email without a password before the round trip', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlatformStores />);
    await screen.findByText('Nova Sports');

    await user.click(screen.getByRole('button', { name: /new store/i }));
    await screen.findByRole('heading', { name: 'New store' });
    await user.type(screen.getByLabelText('Store name'), 'Acme Co');
    await user.type(screen.getByLabelText('Admin email'), 'owner@acme.test');
    await user.click(screen.getByRole('button', { name: /create store/i }));

    expect(createMock).not.toHaveBeenCalled();
    expect(await screen.findByText(/required when an admin email is given/i)).toBeInTheDocument();
  });

  it('surfaces a slug collision on the slug field', async () => {
    createMock.mockRejectedValue(new ApiError(409, 'STORE_SLUG_EXISTS', 'taken'));
    const user = userEvent.setup();
    renderWithProviders(<PlatformStores />);
    await screen.findByText('Nova Sports');

    await user.click(screen.getByRole('button', { name: /new store/i }));
    await screen.findByRole('heading', { name: 'New store' });
    await user.type(screen.getByLabelText('Store name'), 'Acme Co');
    await user.click(screen.getByRole('button', { name: /create store/i }));

    await waitFor(() => expect(createMock).toHaveBeenCalled());
    expect(await screen.findByText(/already taken by another store/i)).toBeInTheDocument();
  });

  it('derives the slug from the name so it is never left blank', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlatformStores />);
    await screen.findByText('Nova Sports');

    await user.click(screen.getByRole('button', { name: /new store/i }));
    await screen.findByRole('heading', { name: 'New store' });
    await user.type(screen.getByLabelText('Store name'), 'Acme Co');
    await user.click(screen.getByRole('button', { name: /create store/i }));

    await waitFor(() => expect(createMock).toHaveBeenCalled());
    expect(createMock.mock.calls[0][0]).toMatchObject({ name: 'Acme Co', slug: 'acme-co' });
  });
});
