import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import { WhatsAppFloatingButton } from './WhatsAppFloatingButton';
import { getPublicStore } from '@/api/store';
import type { PublicStoreResponse } from '@/lib/types';

vi.mock('@/api/store', () => ({
  getPublicStore: vi.fn(),
}));

const mockGetStore = vi.mocked(getPublicStore);

const baseStore: PublicStoreResponse = {
  slug: 'test-store',
  name: 'Amanly Sweets',
  currency: 'INR',
  codEnabled: true,
  onlinePaymentEnabled: true,
  whatsappNumber: '+91 98350 12345',
  features: ['CATALOG', 'WHATSAPP_COMMERCE'],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetStore.mockResolvedValue(baseStore);
});

describe('WhatsAppFloatingButton', () => {
  it('does not render if store has no whatsappNumber configured', async () => {
    mockGetStore.mockResolvedValue({ ...baseStore, whatsappNumber: null });
    const { container } = renderWithProviders(<WhatsAppFloatingButton />);

    await waitFor(() => expect(mockGetStore).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });

  it('renders floating button with correct wa.me link for commerce store', async () => {
    renderWithProviders(<WhatsAppFloatingButton />);

    const link = await screen.findByRole('link', { name: /Chat and Order on WhatsApp/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining('https://wa.me/919835012345?text=')
    );
    expect(link.getAttribute('href')).toContain(
      encodeURIComponent('Hi Amanly Sweets! I would like to browse products and place an order on WhatsApp.')
    );
  });

  it('renders floating button with inquiry text when WHATSAPP_COMMERCE is not enabled', async () => {
    mockGetStore.mockResolvedValue({ ...baseStore, features: ['CATALOG'] });
    renderWithProviders(<WhatsAppFloatingButton />);

    const link = await screen.findByRole('link', { name: /Chat and Order on WhatsApp/i });
    expect(link.getAttribute('href')).toContain(
      encodeURIComponent('Hi Amanly Sweets! I would like to inquire about your products.')
    );
  });

  it('dismisses badge when user clicks dismiss', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WhatsAppFloatingButton />);

    const dismissBtn = await screen.findByRole('button', { name: /Dismiss WhatsApp badge/i });
    await user.click(dismissBtn);

    expect(screen.queryByText('Order on WhatsApp')).not.toBeInTheDocument();
  });
});