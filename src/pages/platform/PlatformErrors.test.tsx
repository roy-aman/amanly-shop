import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlatformErrors from './PlatformErrors';
import { platformErrors, platformStores } from '@/api/platform';
import type { ErrorEventDetailResponse, ErrorEventResponse, Page } from '@/lib/types';
import { renderWithProviders } from '@/test/utils';

vi.mock('@/api/platform', () => ({
  platformErrors: {
    list: vi.fn(),
    get: vi.fn(),
    getByReference: vi.fn(),
    setResolved: vi.fn(),
    setMuted: vi.fn(),
    remove: vi.fn(),
  },
  platformStores: { list: vi.fn() },
}));
const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), push: vi.fn() };
vi.mock('@/context/ToastContext', () => ({ useToast: () => toast }));

const listMock = vi.mocked(platformErrors.list);
const getMock = vi.mocked(platformErrors.get);
const storesMock = vi.mocked(platformStores.list);

/** A long admin path — the case where truncation actually loses the useful part. */
const LONG_PATH = '/api/v1/admin/products/3f8c1b9e-2a44-4c77-9e21-6d0b5a7c1f33/images/9a1d/primary';

function event(over: Partial<ErrorEventResponse> = {}): ErrorEventResponse {
  return {
    id: 'e1',
    reference: 'ERR-7K4QP2X9',
    occurrences: 3,
    firstSeenAt: '2026-08-17T04:00:00Z',
    lastSeenAt: '2026-08-17T05:14:02Z',
    source: 'HTTP',
    storeId: null,
    httpMethod: 'PATCH',
    path: LONG_PATH,
    status: 500,
    exceptionClass: 'org.springframework.dao.DataIntegrityViolationException',
    message: 'could not execute statement [ERROR: duplicate key value violates unique constraint]',
    resolved: false,
    muted: false,
  } as ErrorEventResponse;
}

function page(content: ErrorEventResponse[]): Page<ErrorEventResponse> {
  return {
    content,
    totalElements: content.length,
    totalPages: 1,
    size: 20,
    number: 0,
    first: true,
    last: true,
    numberOfElements: content.length,
    empty: content.length === 0,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  storesMock.mockResolvedValue([]);
  listMock.mockResolvedValue(page([event()]));
  getMock.mockResolvedValue({
    summary: event(),
    queryString: 'dryRun=false&size=20',
    stackTrace: 'org.springframework.dao.DataIntegrityViolationException\n\tat com.royalcommerce…',
  } as unknown as ErrorEventDetailResponse);
});

describe('Platform errors', () => {
  /**
   * The endpoint IS the identity of an HTTP failure, and the elided tail is exactly the part an
   * operator needs to reproduce it — for this very error, the `/images/{id}/primary` suffix.
   */
  it('shows the whole endpoint rather than an elided one', async () => {
    renderWithProviders(<PlatformErrors />);

    const line = await screen.findByText(`PATCH ${LONG_PATH}`);
    expect(line).toBeInTheDocument();
    expect(line.className).not.toContain('truncate');
  });

  it('shows the short message and when it last happened', async () => {
    renderWithProviders(<PlatformErrors />);

    expect(await screen.findByText(/duplicate key value violates unique constraint/i)).toBeInTheDocument();
    expect(screen.getByText(/×3/)).toBeInTheDocument();
  });

  /** Rejoined so it can go straight into curl instead of being reassembled by hand. */
  it('rebuilds the full request line with its query when opened', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlatformErrors />);

    await user.click(await screen.findByText(`PATCH ${LONG_PATH}`));

    await waitFor(() => expect(getMock).toHaveBeenCalledWith('e1'));
    expect(await screen.findByText(`PATCH ${LONG_PATH}?dryRun=false&size=20`)).toBeInTheDocument();
  });

  it('shows the stack trace only once a row is opened', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlatformErrors />);

    expect(getMock).not.toHaveBeenCalled();

    await user.click(await screen.findByText(`PATCH ${LONG_PATH}`));

    expect(await screen.findByText(/at com.royalcommerce/)).toBeInTheDocument();
  });

  /** The backend default is lastSeenAt DESC; sending a sort here would silently override it. */
  it('leaves the ordering to the server so the newest failures lead', async () => {
    renderWithProviders(<PlatformErrors />);

    await waitFor(() => expect(listMock).toHaveBeenCalled());
    expect(listMock.mock.calls[0][0]).not.toHaveProperty('sort');
  });
});
