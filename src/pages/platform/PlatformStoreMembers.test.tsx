import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/test/utils';
import PlatformStoreMembers from './PlatformStoreMembers';
import { platformStoreUsers, platformStores } from '@/api/platform';
import { ApiError } from '@/lib/http';
import type { Page, RoleName, StoreAdminSummaryResponse, UserResponse, UserStatus } from '@/lib/types';

vi.mock('@/api/platform', () => ({
  platformStores: { get: vi.fn() },
  platformStoreUsers: { list: vi.fn(), changeRoles: vi.fn() },
}));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useParams: () => ({ storeId: 'store-1' }) };
});
const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), push: vi.fn() };
vi.mock('@/context/ToastContext', () => ({ useToast: () => toast }));

const storeGet = vi.mocked(platformStores.get);
const listMock = vi.mocked(platformStoreUsers.list);
const rolesMock = vi.mocked(platformStoreUsers.changeRoles);

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

function member(
  id: string,
  email: string,
  roles: RoleName[],
  status: UserStatus = 'ACTIVE',
  fullName = 'Member ' + id,
): UserResponse {
  return {
    id,
    email,
    fullName,
    provider: 'LOCAL',
    status,
    roles,
    emailVerifiedAt: null,
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  };
}

function page(content: UserResponse[], overrides: Partial<Page<UserResponse>> = {}): Page<UserResponse> {
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
    ...overrides,
  };
}

const MEMBERS = [
  member('u1', 'owner@nova.test', ['CUSTOMER', 'STAFF', 'ADMIN'], 'ACTIVE', 'Olive Owner'),
  member('u2', 'staffer@nova.test', ['CUSTOMER', 'STAFF'], 'ACTIVE', 'Sam Staff'),
  member('u3', 'shopper@nova.test', ['CUSTOMER'], 'ACTIVE', 'Casey Customer'),
  member('u4', 'locked@nova.test', ['CUSTOMER'], 'LOCKED', 'Lee Locked'),
  member('u5', 'ops@platform.test', ['CUSTOMER', 'PLATFORM_ADMIN'], 'ACTIVE', 'Ops Person'),
];

function renderPage(initialUrl = '/platform/stores/store-1/members') {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={[initialUrl]}>
        <PlatformStoreMembers />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  storeGet.mockResolvedValue(store());
  listMock.mockResolvedValue(page(MEMBERS));
  rolesMock.mockImplementation((_s, userId, roles) =>
    Promise.resolve(member(userId, 'staffer@nova.test', roles as RoleName[])),
  );
});

describe('Store members — listing', () => {
  it('lists members with their role at THIS store', async () => {
    renderPage();
    expect(await screen.findByText('Olive Owner')).toBeInTheDocument();
    expect(screen.getByText('Casey Customer')).toBeInTheDocument();
    expect(screen.getByText('5 members · 5 staff seats')).toBeInTheDocument();
  });

  it('reads search, filters and page from the URL so a link is shareable', async () => {
    renderPage('/platform/stores/store-1/members?q=sam&role=STAFF&page=2');
    await waitFor(() => expect(listMock).toHaveBeenCalled());
    expect(listMock).toHaveBeenCalledWith('store-1', expect.objectContaining({ search: 'sam', page: 2 }));
  });

  it('sends the search to the server, which is the only filter it supports', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Olive Owner');

    await user.type(screen.getByLabelText('Search members'), 'sam');
    await waitFor(() =>
      expect(listMock).toHaveBeenCalledWith('store-1', expect.objectContaining({ search: 'sam' })),
    );
  });
});

describe('Store members — filters', () => {
  it('narrows to admins without counting staff as admins', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Olive Owner');

    await user.click(screen.getByRole('button', { name: 'Admins' }));

    expect(await screen.findByText('Olive Owner')).toBeInTheDocument();
    // Roles are cumulative, so the admin also holds STAFF — but "Staff" must not
    // return them, or the filter cannot tell the two apart.
    expect(screen.queryByText('Sam Staff')).not.toBeInTheDocument();
    expect(screen.queryByText('Casey Customer')).not.toBeInTheDocument();
  });

  it('narrows to staff, excluding the admin', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Olive Owner');

    await user.click(screen.getByRole('button', { name: 'Staff' }));

    expect(await screen.findByText('Sam Staff')).toBeInTheDocument();
    expect(screen.queryByText('Olive Owner')).not.toBeInTheDocument();
  });

  it('filters by account status', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Olive Owner');

    await user.click(screen.getByRole('button', { name: 'Locked' }));

    expect(await screen.findByText('Lee Locked')).toBeInTheDocument();
    expect(screen.queryByText('Casey Customer')).not.toBeInTheDocument();
  });

  it('loads a bigger page while filtering, since the API cannot filter by role', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Olive Owner');

    await user.click(screen.getByRole('button', { name: 'Admins' }));

    await waitFor(() => expect(listMock).toHaveBeenCalledWith('store-1', expect.objectContaining({ size: 200 })));
  });

  it('says so when a filter can only see part of the membership', async () => {
    listMock.mockResolvedValue(page(MEMBERS, { totalElements: 4000, totalPages: 20 }));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Olive Owner');

    await user.click(screen.getByRole('button', { name: 'Admins' }));

    // Presenting 5-of-4000 as the answer would be a lie the operator cannot see.
    expect(await screen.findByText(/applied to the 5 members loaded here, out of 4000/i)).toBeInTheDocument();
  });

  it('stays quiet when everything is loaded', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Olive Owner');

    await user.click(screen.getByRole('button', { name: 'Admins' }));

    await screen.findByText('Olive Owner');
    expect(screen.queryByText(/loaded here, out of/i)).not.toBeInTheDocument();
  });

  it('offers an empty state rather than a blank table', async () => {
    listMock.mockResolvedValue(page([MEMBERS[2]]));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Casey Customer');

    await user.click(screen.getByRole('button', { name: 'Admins' }));
    expect(await screen.findByText('Nobody matches that')).toBeInTheDocument();
  });
});

describe('Store members — role editing', () => {
  it('confirms before promoting, and spells out what the role grants', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Sam Staff');

    await user.selectOptions(screen.getByLabelText('Role for staffer@nova.test'), 'ADMIN');

    // Nothing is sent until it is confirmed.
    expect(rolesMock).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/full control of this store/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/their roles at other shops are untouched/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /make admin/i }));
    // Roles are replaced wholesale and are cumulative.
    await waitFor(() => expect(rolesMock).toHaveBeenCalledWith('store-1', 'u2', ['CUSTOMER', 'STAFF', 'ADMIN']));
  });

  it('demotes to customer with the full role set, not a delta', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Sam Staff');

    await user.selectOptions(screen.getByLabelText('Role for staffer@nova.test'), 'CUSTOMER');
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /make customer/i }));

    await waitFor(() => expect(rolesMock).toHaveBeenCalledWith('store-1', 'u2', ['CUSTOMER']));
  });

  it('leaves a platform operator uneditable and says where to go', async () => {
    renderPage();
    await screen.findByText('Ops Person');

    expect(screen.queryByLabelText('Role for ops@platform.test')).not.toBeInTheDocument();
    expect(screen.getByText('Managed in Operators')).toBeInTheDocument();
    expect(screen.getByText('Platform operator')).toBeInTheDocument();
  });

  it('explains a seat-limit rejection instead of a raw error', async () => {
    rolesMock.mockRejectedValue(new ApiError(409, 'STAFF_SEAT_LIMIT_REACHED', 'full'));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Casey Customer');

    await user.selectOptions(screen.getByLabelText('Role for shopper@nova.test'), 'STAFF');
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /make staff/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('No staff seats left', expect.any(String)));
  });

  it('redirects a CANNOT_MODIFY_PLATFORM_ADMIN rejection to the right screen', async () => {
    rolesMock.mockRejectedValue(new ApiError(403, 'CANNOT_MODIFY_PLATFORM_ADMIN', 'no'));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Casey Customer');

    await user.selectOptions(screen.getByLabelText('Role for shopper@nova.test'), 'STAFF');
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /make staff/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('That account is a platform operator', expect.any(String)),
    );
  });

  it('says out loud that the change is scoped to this store', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Sam Staff');

    await user.selectOptions(screen.getByLabelText('Role for staffer@nova.test'), 'ADMIN');
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /make admin/i }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('is now admin'),
        expect.stringContaining('per store'),
      ),
    );
  });
});
