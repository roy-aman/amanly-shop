import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LEXICON_DEFAULTS, useLexicon } from './lexicon';
import type { PublicStoreResponse } from './types';

vi.mock('@/api/store', () => ({ getPublicStore: vi.fn() }));

const { getPublicStore } = await import('@/api/store');

const BASE: PublicStoreResponse = {
  slug: 'bakes',
  name: 'Bakes',
  currency: 'INR',
  codEnabled: true,
  onlinePaymentEnabled: false,
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

async function lexiconFor(store: PublicStoreResponse) {
  vi.mocked(getPublicStore).mockResolvedValue(store);
  const { result } = renderHook(() => useLexicon(), { wrapper });
  await waitFor(() => expect(vi.mocked(getPublicStore)).toHaveBeenCalled());
  await waitFor(() => expect(result.current.t('product')).toBeTruthy());
  return result;
}

describe('useLexicon', () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the shop's own words", async () => {
    const result = await lexiconFor({
      ...BASE,
      lexicon: { product: 'cake', products: 'cakes', categories: 'occasions' },
    });

    await waitFor(() => expect(result.current.t('products')).toBe('cakes'));
    expect(result.current.t('categories')).toBe('occasions');
  });

  /**
   * A term the server did not answer — an older backend, a payload cached before
   * the term existed — must render this bundle's default. A heading reading
   * `undefined` is worse than one reading the platform's own word.
   */
  it('falls back to the platform default for a term the payload omits', async () => {
    const result = await lexiconFor({ ...BASE, lexicon: { products: 'cakes' } });

    await waitFor(() => expect(result.current.t('products')).toBe('cakes'));
    expect(result.current.t('brands')).toBe(LEXICON_DEFAULTS.brands);
    expect(result.current.t('nav.diary')).toBe('Diary');
  });

  it('falls back entirely when the payload carries no lexicon at all', async () => {
    const result = await lexiconFor({ ...BASE });

    expect(result.current.t('products')).toBe('Products');
  });

  /**
   * Only the first character, so a merchant who deliberately typed "Diwali
   * Boxes" keeps their capital B. Lower-casing the whole string would quietly
   * rewrite a proper noun every time it appeared mid-sentence.
   */
  it('lower-cases only the first letter for mid-sentence use', async () => {
    const result = await lexiconFor({ ...BASE, lexicon: { products: 'Diwali Boxes' } });

    await waitFor(() => expect(result.current.lower('products')).toBe('diwali Boxes'));
  });

  it('treats a blank override as no override', async () => {
    const result = await lexiconFor({ ...BASE, lexicon: { products: '   ' } });

    await waitFor(() => expect(result.current.t('products')).toBe('Products'));
  });
});
