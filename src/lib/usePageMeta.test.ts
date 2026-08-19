import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePageMeta } from './usePageMeta';

const DEFAULT_DESCRIPTION = 'Amanly — built for modern men.';

function descriptionTag(): HTMLMetaElement {
  return document.querySelector<HTMLMetaElement>('meta[name="description"]')!;
}

function canonicalHref(): string | null {
  return document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? null;
}

beforeEach(() => {
  document.head.innerHTML = `<meta name="description" content="${DEFAULT_DESCRIPTION}" />`;
});

afterEach(() => {
  document.head.innerHTML = '';
});

describe('usePageMeta', () => {
  it('gives the view its own description and puts the document default back on the way out', () => {
    const { unmount } = renderHook(() => usePageMeta({ description: 'Caps, chosen for fit.' }));

    expect(descriptionTag().content).toBe('Caps, chosen for fit.');

    unmount();
    expect(descriptionTag().content).toBe(DEFAULT_DESCRIPTION);
  });

  /** Nothing to say is not something to say — a blank description must not blank the default. */
  it('leaves the default alone when the view has no copy of its own', () => {
    renderHook(() => usePageMeta({ description: null }));

    expect(descriptionTag().content).toBe(DEFAULT_DESCRIPTION);
  });

  /** Results truncate past ~160 characters, so the cut should land on a word, not mid-syllable. */
  it('trims a long description at a word boundary', () => {
    const long = `${'word '.repeat(60)}end`;
    renderHook(() => usePageMeta({ description: long }));

    const content = descriptionTag().content;
    expect(content.length).toBeLessThanOrEqual(161);
    expect(content.endsWith('…')).toBe(true);
    expect(content).not.toContain('wor…');
  });

  it('collapses whitespace so a multi-line blurb becomes one line', () => {
    renderHook(() => usePageMeta({ description: '  Caps.\n\n  Chosen for fit.  ' }));

    expect(descriptionTag().content).toBe('Caps. Chosen for fit.');
  });

  /**
   * The canonical is the part that earns its keep: the same goods are reachable under a dozen
   * sort/page/view URLs, which is the duplicate-content shape crawlers punish.
   */
  it('names one address for the view, absolute, and removes it on the way out', () => {
    const { unmount } = renderHook(() =>
      usePageMeta({ canonicalPath: '/products?categoryId=c1' }),
    );

    expect(canonicalHref()).toBe(`${window.location.origin}/products?categoryId=c1`);

    unmount();
    expect(canonicalHref()).toBeNull();
  });

  it('adds no canonical when the caller names no address', () => {
    renderHook(() => usePageMeta({ description: 'Caps.' }));

    expect(canonicalHref()).toBeNull();
  });
});
