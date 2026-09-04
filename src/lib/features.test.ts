import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useConsoleFeatures, useStoreFeatures } from './features';
import type { PublicStoreResponse } from './types';

vi.mock('@/api/store', () => ({ getPublicStore: vi.fn() }));
vi.mock('@/api/admin', () => ({ adminStore: { get: vi.fn(), features: vi.fn() } }));

const { getPublicStore } = await import('@/api/store');
const { adminStore } = await import('@/api/admin');

const BASE: PublicStoreResponse = {
  slug: 'nova',
  name: 'Nova',
  currency: 'INR',
  codEnabled: true,
  onlinePaymentEnabled: false,
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

async function gateFor(store: PublicStoreResponse) {
  vi.mocked(getPublicStore).mockResolvedValue(store);
  const { result } = renderHook(() => useStoreFeatures(), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result;
}

describe('useStoreFeatures', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows only the sections the store was granted', async () => {
    const result = await gateFor({ ...BASE, features: ['CATALOG', 'SALES'] });

    expect(result.current.has('CATALOG')).toBe(true);
    expect(result.current.has('SALES')).toBe(true);
    expect(result.current.has('BOOKINGS')).toBe(false);
  });

  /**
   * The distinction this whole file turns on. An empty list is a backend that
   * knows about sections saying this store has none; an ABSENT list is a backend
   * that has never heard of them, and that backend serves everything.
   *
   * Getting this backwards is not a cosmetic bug: it empties every live shop the
   * moment this bundle ships ahead of the backend, which is the normal order of
   * a release.
   */
  it('treats an absent list as "nothing is gated", not as "nothing is granted"', async () => {
    const result = await gateFor({ ...BASE });

    expect(result.current.has('CATALOG')).toBe(true);
    expect(result.current.has('BOOKINGS')).toBe(true);
    expect(result.current.gated).toBe(false);
  });

  it('treats an empty list as a store with no sections', async () => {
    const result = await gateFor({ ...BASE, features: [] });

    expect(result.current.has('CATALOG')).toBe(false);
    expect(result.current.gated).toBe(true);
  });

  /** A newer backend will name sections this bundle has never heard of. */
  it('ignores names it does not recognise rather than breaking', async () => {
    const result = await gateFor({ ...BASE, features: ['CATALOG', 'SOMETHING_NEW'] });

    expect(result.current.has('CATALOG')).toBe(true);
    expect(result.current.has('SALES')).toBe(false);
  });

  /**
   * A request that failed is not an answer. Reporting "no sections" would blank
   * the shop on a blip; the caller waits on `loading` and shows a skeleton.
   */
  it('reports nothing granted while the payload is still in flight', async () => {
    vi.mocked(getPublicStore).mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useStoreFeatures(), { wrapper });

    expect(result.current.loading).toBe(true);
  });
});

describe('useConsoleFeatures', () => {
  beforeEach(() => vi.clearAllMocks());

  async function consoleGate(features: string[] | undefined) {
    vi.mocked(adminStore.features).mockResolvedValue({ features: features as string[] });
    const { result } = renderHook(() => useConsoleFeatures(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    return result;
  }

  it('shows only the sections the store has been granted', async () => {
    const result = await consoleGate(['OVERVIEW', 'CATALOG']);

    expect(result.current.has('CATALOG')).toBe(true);
    expect(result.current.has('INSIGHTS')).toBe(false);
  });

  /**
   * The bug this endpoint exists to fix.
   *
   * The gate used to read `/admin/store`, which is ADMIN-only because it carries
   * payment keys. A STAFF user got a 403, so the gate had no answer — and no
   * answer means "nothing is gated", which is right for a backend that predates
   * section grants and exactly wrong for a user who was simply refused. Staff
   * therefore saw every section regardless of the store's grants: the gate
   * silently did nothing for the role that lives in the console.
   *
   * Asserting on the URL rather than the outcome, because the outcome for staff
   * cannot be told apart from a working gate without a real 403 — the point is
   * that this reads the endpoint staff can actually reach.
   */
  it('reads the staff-readable endpoint, not the admin-only settings payload', async () => {
    await consoleGate(['CATALOG']);

    expect(vi.mocked(adminStore.features)).toHaveBeenCalled();
    expect(vi.mocked(adminStore.get)).not.toHaveBeenCalled();
  });

  /** An older backend has no such endpoint. One 404 is the answer, not a retry. */
  it('falls back to showing everything when the backend has no such endpoint', async () => {
    vi.mocked(adminStore.features).mockRejectedValue(new Error('404'));
    const { result } = renderHook(() => useConsoleFeatures(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.has('CATALOG')).toBe(true);
    expect(result.current.gated).toBe(false);
  });
});
