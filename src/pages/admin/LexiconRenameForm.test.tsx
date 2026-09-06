import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '@/test/utils';
import AdminSettings from './AdminSettings';
import { adminStore } from '@/api/admin';
import type { StoreSettingsResponse } from '@/lib/types';

vi.mock('@/api/admin', () => ({
  adminStore: {
    get: vi.fn(),
    updateStorefrontContent: vi.fn(),
    updateLexicon: vi.fn(),
    updateCommerce: vi.fn(),
    updatePayment: vi.fn(),
    upiSettings: vi.fn(),
    updateUpiSettings: vi.fn(),
    updateWhatsapp: vi.fn(),
  },
}));
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), push: vi.fn() }),
}));

const getMock = vi.mocked(adminStore.get);
const updateLexiconMock = vi.mocked(adminStore.updateLexicon);

function store(overrides: Partial<StoreSettingsResponse> = {}): StoreSettingsResponse {
  return {
    id: 'store-1',
    slug: 'royal',
    name: 'Royal Sweets',
    currency: 'INR',
    status: 'ACTIVE',
    codEnabled: true,
    onlinePaymentEnabled: false,
    razorpayKeyId: null,
    razorpayConfigured: false,
    whatsappEnabled: false,
    ...overrides,
  } as StoreSettingsResponse;
}

beforeEach(() => {
  vi.clearAllMocks();
  getMock.mockResolvedValue(store());
  updateLexiconMock.mockResolvedValue(store());
});

/**
 * The wording form, as two folded groups.
 *
 * <p>It used to be four groups of inputs with the console terms behind an unlabelled ghost
 * button at the bottom — which a merchant looking for the sidebar's own words scrolled past,
 * concluding the nav could not be renamed at all. The feature existed; nobody could find it,
 * and those are different claims.
 */
describe('the wording form', () => {
  const openCard = async (user: ReturnType<typeof userEvent.setup>) =>
    user.click(await screen.findByText('What you call things'));

  const group = (name: RegExp) => screen.getByRole('button', { name });

  it('names both groups, and how much is in each, before either is opened', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminSettings />);
    await openCard(user);

    expect(await screen.findByText('What you serve and sell')).toBeInTheDocument();
    expect(screen.getByText('This console')).toBeInTheDocument();
    // The count is the point: it says how much is behind the fold without opening it.
    expect(group(/This console/)).toHaveTextContent(/\d+ terms/);
    // And nothing is expanded yet.
    expect(screen.queryByLabelText('Your word for Inventory in the console')).not.toBeInTheDocument();
  });

  it('opens the console group to the real nav terms', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminSettings />);
    await openCard(user);

    await user.click(group(/This console/));

    // Marked "in the console" so the nav's Orders is not confused with a customer's.
    expect(await screen.findByLabelText('Your word for Inventory in the console')).toBeInTheDocument();
    expect(screen.getByLabelText('Your word for Diary in the console')).toBeInTheDocument();
    expect(screen.getByLabelText('Your word for Orders in the console')).toBeInTheDocument();
  });

  /** Only what is being worked on stays on screen — forty-eight inputs at once was the problem. */
  it('opening one group closes the other', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminSettings />);
    await openCard(user);

    await user.click(group(/This console/));
    expect(await screen.findByLabelText('Your word for Inventory in the console')).toBeInTheDocument();

    await user.click(group(/What you serve and sell/));

    await waitFor(() =>
      expect(screen.queryByLabelText('Your word for Inventory in the console')).not.toBeInTheDocument(),
    );
    // The customer-facing noun of the same name is a different box, and it is the one now open.
    expect(screen.getByLabelText('Your word for Orders')).toBeInTheDocument();
  });

  /** The end of the loop: what is typed here is what the save sends. */
  it('sends a renamed nav term as an override', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminSettings />);
    await openCard(user);
    await user.click(group(/This console/));

    await user.type(await screen.findByLabelText('Your word for Inventory in the console'), 'Stock');
    await user.click(screen.getByRole('button', { name: /save wording/i }));

    await waitFor(() => expect(updateLexiconMock).toHaveBeenCalled());
    expect(updateLexiconMock.mock.calls[0][0].terms).toMatchObject({ 'nav.inventory': 'Stock' });
  });
});
