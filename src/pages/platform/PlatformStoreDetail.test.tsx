import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import PlatformStoreDetail from './PlatformStoreDetail';
import { platformDomains, platformStores } from '@/api/platform';
import { ApiError } from '@/lib/http';
import type { StoreAdminSummaryResponse, StoreDomainResponse } from '@/lib/types';

vi.mock('@/api/platform', () => ({
  platformStores: {
    get: vi.fn(), update: vi.fn(), updateEntitlements: vi.fn(), list: vi.fn(), create: vi.fn(), remove: vi.fn(),
  },
  platformDomains: { list: vi.fn(), add: vi.fn(), rename: vi.fn(), makePrimary: vi.fn(), remove: vi.fn() },
}));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useParams: () => ({ storeId: 'store-1' }) };
});
const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), push: vi.fn() };
vi.mock('@/context/ToastContext', () => ({ useToast: () => toast }));

const getMock = vi.mocked(platformStores.get);
const entitlementsMock = vi.mocked(platformStores.updateEntitlements);
const updateMock = vi.mocked(platformStores.update);
const domainsListMock = vi.mocked(platformDomains.list);
const domainAddMock = vi.mocked(platformDomains.add);
const domainRemoveMock = vi.mocked(platformDomains.remove);
const domainRenameMock = vi.mocked(platformDomains.rename);

function store(overrides: Partial<StoreAdminSummaryResponse> = {}): StoreAdminSummaryResponse {
  return {
    id: 'store-1',
    slug: 'nova',
    name: 'Nova Sports',
    status: 'ACTIVE',
    currency: 'INR',
    codEnabled: true,
    onlinePaymentConfigured: false,
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

function domain(overrides: Partial<StoreDomainResponse> = {}): StoreDomainResponse {
  return { id: 'd1', hostname: 'novasports.in', primary: true, createdAt: '2026-01-01T00:00:00Z', ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  getMock.mockResolvedValue(store());
  domainsListMock.mockResolvedValue([domain()]);
  entitlementsMock.mockResolvedValue(store());
  updateMock.mockResolvedValue(store());
});

describe('Platform store detail — entitlements', () => {
  it('submits EVERY field, not just the one that changed', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlatformStoreDetail />);
    await screen.findByText('Entitlements');

    await user.click(screen.getByRole('checkbox', { name: /marketing email/i }));
    await user.click(screen.getByRole('button', { name: /save entitlements/i }));

    await waitFor(() => expect(entitlementsMock).toHaveBeenCalled());
    // A partial patch here silently switches off whatever it omits.
    expect(entitlementsMock).toHaveBeenCalledWith('store-1', {
      onlinePaymentsAllowed: true,
      whatsappNotificationsAllowed: true,
      whatsappCommerceAllowed: false,
      emailNotificationsAllowed: true,
      marketingEmailAllowed: true,
      customDomainAllowed: true,
      imageUploadAllowed: false,
      aiImageGenerationAllowed: false,
      bookingsAllowed: false,
      maxStaffSeats: 5,
      maxImageUploads: null,
      maxAiImageGenerations: null,
    });
  });

  /**
   * Bookings had no switch here at all, which was worse than it sounds: the API requires every
   * boolean and rejects an omission outright, so a console missing one flag cannot save *any*
   * entitlement change. Saving returned a 400 that named no field, and the beauty-parlour vertical
   * could not be granted to anyone.
   */
  it('can grant bookings, and sends it with everything else', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlatformStoreDetail />);
    await screen.findByText('Entitlements');

    await user.click(screen.getByRole('checkbox', { name: /bookings/i }));
    await user.click(screen.getByRole('button', { name: /save entitlements/i }));

    await waitFor(() => expect(entitlementsMock).toHaveBeenCalled());
    expect(entitlementsMock.mock.calls[0][1]).toMatchObject({ bookingsAllowed: true });
  });

  it('turning WhatsApp commerce on turns notifications on with it', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlatformStoreDetail />);
    await screen.findByText('Entitlements');

    await user.click(screen.getByRole('checkbox', { name: /whatsapp notifications/i })); // off
    expect(screen.getByRole('checkbox', { name: /whatsapp commerce/i })).not.toBeChecked();

    await user.click(screen.getByRole('checkbox', { name: /whatsapp commerce/i })); // on
    expect(screen.getByRole('checkbox', { name: /whatsapp notifications/i })).toBeChecked();
  });

  it('warns and names the hostnames before the one destructive withdrawal', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlatformStoreDetail />);
    await screen.findByText('Entitlements');

    await user.click(screen.getByRole('checkbox', { name: /custom domain/i }));
    await user.click(screen.getByRole('button', { name: /save entitlements/i }));

    // Nothing is sent until the operator confirms.
    expect(entitlementsMock).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/novasports\.in/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /detach and save/i }));
    await waitFor(() => expect(entitlementsMock).toHaveBeenCalled());
    expect(entitlementsMock.mock.calls[0][1].customDomainAllowed).toBe(false);
  });

  it('does not nag when the store holds no domains to detach', async () => {
    domainsListMock.mockResolvedValue([]);
    const user = userEvent.setup();
    renderWithProviders(<PlatformStoreDetail />);
    await screen.findByText('Entitlements');

    await user.click(screen.getByRole('checkbox', { name: /custom domain/i }));
    await user.click(screen.getByRole('button', { name: /save entitlements/i }));

    await waitFor(() => expect(entitlementsMock).toHaveBeenCalled());
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('sends null for empty staff seats (unlimited), never 0', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlatformStoreDetail />);
    await screen.findByText('Entitlements');

    await user.clear(screen.getByLabelText(/staff seats/i));
    await user.click(screen.getByRole('button', { name: /save entitlements/i }));

    await waitFor(() => expect(entitlementsMock).toHaveBeenCalled());
    expect(entitlementsMock.mock.calls[0][1].maxStaffSeats).toBeNull();
  });
});

describe('Platform store detail — domains', () => {
  it('points a CUSTOM_DOMAIN_NOT_ALLOWED rejection at the entitlement', async () => {
    domainAddMock.mockRejectedValue(new ApiError(409, 'CUSTOM_DOMAIN_NOT_ALLOWED', 'Not allowed'));
    const user = userEvent.setup();
    renderWithProviders(<PlatformStoreDetail />);
    await screen.findByText('Addresses');

    await user.type(screen.getByLabelText('Address'), 'second.example');
    await user.click(screen.getByRole('button', { name: /attach/i }));

    expect(await screen.findByText(/not entitled to custom domains/i)).toBeInTheDocument();
  });

  it('reports the hostname the server actually stored, not what was typed', async () => {
    domainsListMock.mockResolvedValue([]);
    domainAddMock.mockResolvedValue(domain({ id: 'd2', hostname: 'novasports.in', primary: true }));
    const user = userEvent.setup();
    renderWithProviders(<PlatformStoreDetail />);
    await screen.findByText('Addresses');

    await user.type(screen.getByLabelText('Address'), 'HTTPS://NovaSports.in/shop ');
    await user.click(screen.getByRole('button', { name: /attach/i }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('novasports.in attached', expect.any(String)));
  });

  /**
   * The move an operator actually makes: a shop built against a dev address goes
   * live on its real domain. Remove-then-add cannot express it — removing the
   * primary is refused while other addresses remain, and where it is the only one
   * the store is unreachable in between.
   */
  it('re-points an address in place rather than detaching it', async () => {
    domainsListMock.mockResolvedValue([domain({ id: 'd1', hostname: 'localhost:5180', primary: true })]);
    domainRenameMock.mockResolvedValue(domain({ id: 'd1', hostname: 'novasports.in', primary: true }));
    const user = userEvent.setup();
    renderWithProviders(<PlatformStoreDetail />);
    await screen.findByText('localhost:5180');

    await user.click(screen.getByRole('button', { name: /change localhost:5180/i }));
    const input = await screen.findByLabelText(/new address for localhost:5180/i);
    await user.clear(input);
    await user.type(input, 'novasports.in');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(domainRenameMock).toHaveBeenCalled());
    expect(domainRenameMock.mock.calls[0][2]).toEqual({ hostname: 'novasports.in' });
    expect(domainRemoveMock).not.toHaveBeenCalled();
  });

  it('shows a re-point rejected as already taken on the field', async () => {
    domainsListMock.mockResolvedValue([domain({ id: 'd1', hostname: 'localhost:5180', primary: true })]);
    domainRenameMock.mockRejectedValue(new ApiError(409, 'DOMAIN_TAKEN', 'taken'));
    const user = userEvent.setup();
    renderWithProviders(<PlatformStoreDetail />);
    await screen.findByText('localhost:5180');

    await user.click(screen.getByRole('button', { name: /change localhost:5180/i }));
    const input = await screen.findByLabelText(/new address for localhost:5180/i);
    await user.clear(input);
    await user.type(input, 'taken.example');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(await screen.findByText(/already belongs to a store/i)).toBeInTheDocument();
  });

  it('explains that the primary must be replaced, not just removed', async () => {
    domainsListMock.mockResolvedValue([domain(), domain({ id: 'd2', hostname: 'www.novasports.in', primary: false })]);
    domainRemoveMock.mockRejectedValue(new ApiError(409, 'CANNOT_REMOVE_PRIMARY_DOMAIN', 'nope'));
    const user = userEvent.setup();
    renderWithProviders(<PlatformStoreDetail />);
    // Wait for the domain list itself, not just the heading, or the row is not
    // mounted yet.
    await screen.findByRole('button', { name: 'Remove novasports.in' });

    await user.click(screen.getByRole('button', { name: 'Remove novasports.in' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Promote another domain first', expect.any(String)));
  });
});

describe('Platform store detail — trading status', () => {
  it('warns before taking a live shop off the air', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlatformStoreDetail />);
    await screen.findByText('Status');

    await user.selectOptions(screen.getByLabelText(/trading status/i), 'SUSPENDED');
    // The field hint also mentions maintenance pages, so match the warning's own
    // "this is about to happen" clause rather than the shared phrase.
    expect(screen.getByText(/as soon as this is saved/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith('store-1', { name: 'Nova Sports', status: 'SUSPENDED' }));
  });

  it('keeps Save inert until something actually changed', async () => {
    renderWithProviders(<PlatformStoreDetail />);
    await screen.findByText('Status');
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
  });
});

describe('Platform store detail — erasing a store', () => {
  const removeMock = vi.mocked(platformStores.remove);

  /**
   * The friction that stands in front of an irreversible act. An id is copied from a list and a
   * mistake looks like any other UUID; typing the store's own slug is a deliberate one.
   */
  it('will not erase until the store slug has been typed back', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlatformStoreDetail />);
    await screen.findByText('Danger zone');

    await user.click(screen.getByRole('button', { name: /erase this store/i }));
    const confirm = await screen.findByRole('button', { name: /erase permanently/i });
    expect(confirm).toBeDisabled();

    await user.type(screen.getByLabelText(/confirm the store slug/i), 'wrong-slug');
    expect(confirm).toBeDisabled();
    expect(removeMock).not.toHaveBeenCalled();
  });

  it('erases once the slug matches', async () => {
    removeMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithProviders(<PlatformStoreDetail />);
    await screen.findByText('Danger zone');

    await user.click(screen.getByRole('button', { name: /erase this store/i }));
    await user.type(screen.getByLabelText(/confirm the store slug/i), 'nova');
    await user.click(screen.getByRole('button', { name: /erase permanently/i }));

    await waitFor(() => expect(removeMock).toHaveBeenCalledWith('store-1', 'nova'));
  });

  /** Erasing the fallback takes down every request that resolves to nothing. */
  it('explains a refusal to erase the fallback store', async () => {
    removeMock.mockRejectedValue(new ApiError(409, 'CANNOT_DELETE_FALLBACK_STORE', 'nope'));
    const user = userEvent.setup();
    renderWithProviders(<PlatformStoreDetail />);
    await screen.findByText('Danger zone');

    await user.click(screen.getByRole('button', { name: /erase this store/i }));
    await user.type(screen.getByLabelText(/confirm the store slug/i), 'nova');
    await user.click(screen.getByRole('button', { name: /erase permanently/i }));

    expect(await screen.findByText(/fallback store/i)).toBeInTheDocument();
  });

  /** "All data" is easy to skim past; "orders" and "memberships" are what make somebody stop. */
  it('spells out what is destroyed rather than summarising it', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlatformStoreDetail />);
    await screen.findByText('Danger zone');

    await user.click(screen.getByRole('button', { name: /erase this store/i }));

    expect(await screen.findByText(/every order and its history/i)).toBeInTheDocument();
    expect(screen.getByText(/everyone's membership of this store/i)).toBeInTheDocument();
    expect(screen.getByText(/People are not deleted/i)).toBeInTheDocument();
  });
});
