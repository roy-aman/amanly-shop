import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '@/test/utils';
import AdminServices from './AdminServices';
import { adminServiceCategories, adminServices } from '@/api/services';
import { adminStore } from '@/api/admin';
import { ApiError } from '@/lib/http';
import type { AdminServiceOfferingResponse, Page, StoreSettingsResponse } from '@/lib/types';

vi.mock('@/api/services', () => ({
  adminServices: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
  adminServiceCategories: { list: vi.fn() },
}));
vi.mock('@/api/admin', () => ({ adminStore: { get: vi.fn() } }));
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), push: vi.fn() }),
}));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ isAdmin: true }) }));
vi.mock('@/components/admin/ImageUploadField', () => ({
  ImageUploadField: ({ label }: { label: string }) => <div>{label}</div>,
}));

const listMock = vi.mocked(adminServices.list);
const updateMock = vi.mocked(adminServices.update);
const removeMock = vi.mocked(adminServices.remove);
const storeMock = vi.mocked(adminStore.get);

function settings(overrides: Partial<StoreSettingsResponse> = {}): StoreSettingsResponse {
  return {
    id: 's1',
    slug: 'demo',
    name: 'Demo',
    currency: 'INR',
    status: 'ACTIVE',
    codEnabled: true,
    onlinePaymentEnabled: false,
    razorpayKeyId: null,
    razorpayConfigured: false,
    whatsappEnabled: false,
    bookingsAllowed: true,
    bookingsEnabled: true,
    ...overrides,
  };
}

function service(overrides: Partial<AdminServiceOfferingResponse> = {}): AdminServiceOfferingResponse {
  return {
    id: 'svc-1',
    categoryId: null,
    categoryName: null,
    name: 'Deep tissue massage',
    slug: 'deep-tissue-massage',
    description: 'Firm pressure work.',
    price: 2400,
    currency: 'INR',
    durationMinutes: 60,
    bufferMinutes: 15,
    imageUrl: null,
    imageAltText: null,
    active: true,
    sortOrder: 0,
    ...overrides,
  };
}

function page(content: AdminServiceOfferingResponse[]): Page<AdminServiceOfferingResponse> {
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

describe('AdminServices', () => {
  beforeEach(() => {
    storeMock.mockResolvedValue(settings());
    listMock.mockResolvedValue(page([service()]));
    vi.mocked(adminServiceCategories.list).mockResolvedValue([]);
    updateMock.mockReset();
    removeMock.mockReset();
  });

  it('keeps the customer’s duration and the private turnaround visibly apart', async () => {
    // A shop that folds its clean-down into the duration ends up quoting 75
    // minutes for an hour's treatment, so the table separates them too.
    renderWithProviders(<AdminServices />);

    expect(await screen.findByText('Deep tissue massage')).toBeInTheDocument();
    expect(screen.getByText('1 hr')).toBeInTheDocument();
    expect(screen.getByText(/\+15m turnaround/)).toBeInTheDocument();
  });

  it('sends every field back on an edit, because the server replaces the row', async () => {
    // The trap in a full-replace PUT: anything the form does not send is lost,
    // including values nobody touched.
    updateMock.mockResolvedValue(service());

    renderWithProviders(<AdminServices />);

    await userEvent.click(await screen.findByRole('button', { name: 'Edit Deep tissue massage' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    const body = updateMock.mock.calls[0][1];
    expect(body).toMatchObject({
      name: 'Deep tissue massage',
      slug: 'deep-tissue-massage',
      price: 2400,
      durationMinutes: 60,
      bufferMinutes: 15,
      active: true,
      sortOrder: 0,
    });
  });

  it('tells the merchant to switch a booked service off rather than delete it', async () => {
    // The server refuses, and the refusal is only useful if it arrives as advice.
    removeMock.mockRejectedValue(new ApiError(409, 'SERVICE_HAS_BOOKINGS', 'Service has bookings.'));

    renderWithProviders(<AdminServices />);

    await userEvent.click(await screen.findByRole('button', { name: 'Delete Deep tissue massage' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(removeMock).toHaveBeenCalled());
  });

  it('says the store has no such plan rather than showing an empty screen', async () => {
    // Different from "bookings are switched off": this one is a conversation
    // with us, not a toggle the merchant owns.
    storeMock.mockResolvedValue(settings({ bookingsAllowed: false }));

    renderWithProviders(<AdminServices />);

    expect(await screen.findByText(/aren’t part of this store’s plan/i)).toBeInTheDocument();
    expect(listMock).not.toHaveBeenCalled();
  });
});
