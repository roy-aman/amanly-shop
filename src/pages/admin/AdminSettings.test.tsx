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
const updateCommerceMock = vi.mocked(adminStore.updateCommerce);

/** A shop that is already set up — every section settled, so every section folded. */
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
    manualUpiAllowed: true,
    manualUpiEnabled: true,
    manualUpiVpa: 'royaman78@axl',
    whatsappEnabled: false,
    shippingFlatAmount: 40,
    freeShippingThreshold: 500,
    taxRatePercent: 5,
    pricesIncludeTax: true,
    pickupEnabled: false,
    heroEyebrow: null,
    heroHeadline: 'Fewer things.\nBetter made.',
    heroSubtext: null,
    lexicon: {},
    ...overrides,
  } as StoreSettingsResponse;
}

describe('AdminSettings — folded sections', () => {
  beforeEach(() => {
    getMock.mockResolvedValue(store());
    updateCommerceMock.mockReset();
    updateCommerceMock.mockResolvedValue(store());
    vi.mocked(adminStore.upiSettings).mockResolvedValue({
      manualUpiEnabled: true,
      manualUpiVpa: 'royaman78@axl',
      tokenVerificationAllowed: false,
      tokenVerificationEnabled: false,
      verifiesByToken: false,
      configs: [],
    } as never);
  });

  /**
   * The point of the fold: a settings page is read far more often than edited, so what a section
   * is set to has to be legible without opening it.
   */
  it('states what a settled section is set to without opening it', async () => {
    renderWithProviders(<AdminSettings />);

    await screen.findByText('Delivery & tax');

    // Folded, so the summary is the only thing said — and it says the actual figures.
    expect(screen.getByText(/Delivery INR 40/)).toBeInTheDocument();
    expect(screen.getByText(/free over INR 500/)).toBeInTheDocument();
    expect(screen.getByText(/5% tax included/)).toBeInTheDocument();

    // ...and the form underneath is not rendered at all.
    expect(screen.queryByRole('button', { name: /Save delivery/i })).not.toBeInTheDocument();
  });

  it('opens a section on Change and folds it again when the save succeeds', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminSettings />);

    await screen.findByText('Delivery & tax');
    await user.click(screen.getByRole('button', { name: /Delivery & tax/i }));

    const save = await screen.findByRole('button', { name: /Save delivery/i });
    await user.click(save);

    await waitFor(() => expect(updateCommerceMock).toHaveBeenCalled());
    // Folded again — "fold once done" is the whole behaviour, not just an initial state.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Save delivery/i })).not.toBeInTheDocument(),
    );
  });

  /**
   * A new shop should be walked through what it genuinely has to fill in, rather than handed a
   * column of closed boxes — so "nothing set yet" is the one state that opens.
   */
  it('starts open when the section has nothing set yet', async () => {
    getMock.mockResolvedValue(store({ heroEyebrow: null, heroHeadline: null, heroSubtext: null }));
    renderWithProviders(<AdminSettings />);

    // The opening-screen form is present without anyone clicking anything.
    expect(await screen.findByRole('button', { name: /Save copy/i })).toBeInTheDocument();
  });

  /** A shop nobody can pay is the one payment state worth interrupting for. */
  it('opens payments, and says so, when no method is enabled', async () => {
    getMock.mockResolvedValue(
      store({ codEnabled: false, onlinePaymentEnabled: false, manualUpiEnabled: false }),
    );
    renderWithProviders(<AdminSettings />);

    expect(await screen.findByRole('button', { name: /Save payment settings/i })).toBeInTheDocument();
  });

  it('summarises the payment methods that are on', async () => {
    renderWithProviders(<AdminSettings />);

    await screen.findByText('Payments');
    expect(screen.getByText(/Cash on delivery · Manual UPI \(royaman78@axl\)/)).toBeInTheDocument();
  });
  // -- one at a time -------------------------------------------------------

  /**
   * Each card used to own its own fold, so opening a second left the first standing — and six
   * forms open at once is the wall of inputs the fold exists to prevent.
   */
  it('closes the open section when another is opened', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminSettings />);

    await screen.findByText('Delivery & tax');
    await user.click(screen.getByRole('button', { name: /Delivery & tax/i }));
    expect(await screen.findByRole('button', { name: /Save delivery/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /What you call things/i }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Save delivery/i })).not.toBeInTheDocument(),
    );
    expect(await screen.findByRole('button', { name: /Save wording/i })).toBeInTheDocument();
  });

  /**
   * The folded row's summary reads from what was SAVED. A section closed mid-edit would
   * otherwise report the old figures back at someone who has just typed new ones, with no sign
   * their work still exists.
   */
  it('marks a section it folded with edits still in it', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminSettings />);

    await screen.findByText('Delivery & tax');
    await user.click(screen.getByRole('button', { name: /Delivery & tax/i }));
    const rate = await screen.findByLabelText(/Tax rate/i);
    await user.clear(rate);
    await user.type(rate, '12');

    await user.click(screen.getByRole('button', { name: /What you call things/i }));

    const folded = await screen.findByRole('button', { name: /Delivery & tax/i });
    expect(folded).toHaveTextContent('Not saved yet');
    // And it invites you back in, rather than offering a fresh "Change".
    expect(folded).toHaveTextContent('Resume');
  });

  /** Folding is not discarding: the edits are still there on the way back in. */
  it('keeps the edits, so reopening resumes rather than restarts', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminSettings />);

    await screen.findByText('Delivery & tax');
    await user.click(screen.getByRole('button', { name: /Delivery & tax/i }));
    const rate = await screen.findByLabelText(/Tax rate/i);
    await user.clear(rate);
    await user.type(rate, '12');

    await user.click(screen.getByRole('button', { name: /What you call things/i }));
    await user.click(screen.getByRole('button', { name: /Delivery & tax/i }));

    expect(await screen.findByLabelText(/Tax rate/i)).toHaveValue(12);
  });

  it('drops the mark once the edits are saved', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminSettings />);

    await screen.findByText('Delivery & tax');
    await user.click(screen.getByRole('button', { name: /Delivery & tax/i }));
    const rate = await screen.findByLabelText(/Tax rate/i);
    await user.clear(rate);
    await user.type(rate, '12');
    await user.click(screen.getByRole('button', { name: /Save delivery/i }));

    await waitFor(() => expect(updateCommerceMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Delivery & tax/i })).not.toHaveTextContent('Not saved yet'),
    );
  });
});
