import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import Banners from './Banners';
import { adminBanners } from '@/api/banners';
import { mediaApi } from '@/api/media';
import type { BannerResponse } from '@/lib/types';

vi.mock('@/api/banners', () => ({
  adminBanners: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    setActive: vi.fn(),
    remove: vi.fn(),
  },
}));
vi.mock('@/api/media', () => ({
  mediaApi: { uploadImages: vi.fn(), quota: vi.fn() },
}));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ isAdmin: true }) }));
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), push: vi.fn() }),
}));

const listMock = vi.mocked(adminBanners.list);
const createMock = vi.mocked(adminBanners.create);
const setActiveMock = vi.mocked(adminBanners.setActive);
const quotaMock = vi.mocked(mediaApi.quota);

function banner(overrides: Partial<BannerResponse> = {}): BannerResponse {
  return {
    id: 'ban-1',
    placement: 'HOME_HERO',
    imageUrl: 'https://cdn.example.com/hero.webp',
    mobileImageUrl: null,
    altText: 'Diwali sale',
    linkUrl: null,
    headline: 'The Diwali Edit',
    subtext: null,
    ctaLabel: null,
    sortOrder: 0,
    active: true,
    startsAt: null,
    endsAt: null,
    live: true,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  listMock.mockResolvedValue([banner()]);
  createMock.mockResolvedValue(banner());
  setActiveMock.mockResolvedValue(banner({ active: false, live: false }));
  quotaMock.mockResolvedValue({
    allowed: true,
    used: 3,
    limit: 10,
    maxFileSizeBytes: 5_242_880,
    maxFilesPerRequest: 10,
    remaining: 7,
  });
});

describe('Admin Banners', () => {
  it('lists banners with their placement', async () => {
    renderWithProviders(<Banners />);
    const row = (await screen.findByText('The Diwali Edit')).closest('li');
    expect(row).not.toBeNull();
    // Scoped to the row: "Home hero" is also an option in the placement filter.
    expect(within(row as HTMLElement).getByText('Home hero')).toBeInTheDocument();
  });

  it('shows an empty state when nothing is booked', async () => {
    listMock.mockResolvedValue([]);
    renderWithProviders(<Banners />);
    expect(await screen.findByText('No banners yet')).toBeInTheDocument();
  });

  // ── the status badge is the whole point of the admin list ──────────────

  it('marks a banner a customer can see as live', async () => {
    renderWithProviders(<Banners />);
    expect(await screen.findByText('Live')).toBeInTheDocument();
  });

  /** "Saved but not showing" has two different causes and one fix each. */
  it('distinguishes a scheduled banner from a switched-off one', async () => {
    listMock.mockResolvedValue([
      banner({
        id: 'later',
        headline: 'Next month',
        live: false,
        active: true,
        startsAt: '2099-01-01T00:00:00Z',
      }),
      banner({ id: 'off', headline: 'Paused', live: false, active: false }),
    ]);

    renderWithProviders(<Banners />);

    expect(await screen.findByText('Scheduled')).toBeInTheDocument();
    expect(screen.getByText('Off')).toBeInTheDocument();
  });

  it('marks a banner whose window has closed as expired', async () => {
    listMock.mockResolvedValue([
      banner({ headline: 'Last week', live: false, active: true, endsAt: '2020-01-01T00:00:00Z' }),
    ]);

    renderWithProviders(<Banners />);
    expect(await screen.findByText('Expired')).toBeInTheDocument();
  });

  // ── actions ────────────────────────────────────────────────────────────

  it('switches a banner off without touching its schedule', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Banners />);
    await screen.findByText('The Diwali Edit');

    await user.click(screen.getByRole('button', { name: /switch off/i }));

    await waitFor(() => expect(setActiveMock).toHaveBeenCalledWith('ban-1', false));
  });

  it('creates a banner from the pasted image URL', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Banners />);
    await screen.findByText('The Diwali Edit');

    await user.click(screen.getByRole('button', { name: /new banner/i }));
    const urlInputs = await screen.findAllByPlaceholderText('https://… or /path');
    await user.type(urlInputs[0], 'https://cdn.example.com/new.webp');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(createMock).toHaveBeenCalled());
    expect(createMock.mock.calls[0][0]).toMatchObject({
      placement: 'HOME_HERO',
      imageUrl: 'https://cdn.example.com/new.webp',
      active: true,
    });
  });

  /** Without an image there is no banner, so saving must not be offered. */
  it('will not create a banner with no image', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Banners />);
    await screen.findByText('The Diwali Edit');

    await user.click(screen.getByRole('button', { name: /new banner/i }));

    expect(await screen.findByRole('button', { name: 'Create' })).toBeDisabled();
    expect(createMock).not.toHaveBeenCalled();
  });

  // ── upload entitlement ─────────────────────────────────────────────────

  it('offers upload when the store is entitled to it', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Banners />);
    await screen.findByText('The Diwali Edit');

    await user.click(screen.getByRole('button', { name: /new banner/i }));

    expect((await screen.findAllByRole('button', { name: /upload/i })).length).toBeGreaterThan(0);
  });

  /**
   * A store without the entitlement must still be able to point at an image it
   * hosts itself, so the URL box stays and only the button goes.
   */
  it('falls back to pasting a URL when uploading is not enabled', async () => {
    quotaMock.mockResolvedValue({
      allowed: false,
      used: 0,
      limit: null,
      maxFileSizeBytes: 5_242_880,
      maxFilesPerRequest: 10,
      remaining: null,
    });
    const user = userEvent.setup();
    renderWithProviders(<Banners />);
    await screen.findByText('The Diwali Edit');

    await user.click(screen.getByRole('button', { name: /new banner/i }));

    expect((await screen.findAllByText(/uploading is not enabled/i)).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /^upload$/i })).not.toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('https://… or /path').length).toBeGreaterThan(0);
  });
});
