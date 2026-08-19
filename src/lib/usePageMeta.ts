import { useEffect } from 'react';

/**
 * Sets the page's `<meta name="description">` and `<link rel="canonical">` for the lifetime of the
 * calling component, restoring what was there on unmount.
 *
 * <p><b>What this is worth, honestly.</b> This is a client-rendered SPA, so these tags are written
 * after hydration. Google executes JavaScript and will generally see them; plenty of other crawlers
 * — Bing on a bad day, and most social-preview scrapers — do not, and read the static tags in
 * index.html instead. So this improves what a JS-capable crawler indexes and does nothing for the
 * rest. Real per-page SEO needs server rendering or prerendering, which is a Phase 7 concern; this
 * is the part that is worth having in the meantime and is not a substitute for it.
 *
 * <p>The canonical matters more than the description here. A category-filtered listing is reachable
 * as `/products?categoryId=X`, `…&sort=price,asc`, `…&page=2` and so on — the same goods under a
 * dozen URLs, which is exactly the duplicate-content shape crawlers penalise. Pointing them all at
 * one address is a bigger win than any wording.
 */
export function usePageMeta({
  description,
  canonicalPath,
}: {
  /** Unique copy for this view. Falsy leaves the document's default in place. */
  description?: string | null;
  /** Path (and query) the crawler should treat as this view's one address, e.g. `/products?categoryId=x`. */
  canonicalPath?: string | null;
}): void {
  useEffect(() => {
    if (!description) return;
    const tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!tag) return;

    const previous = tag.content;
    // Descriptions much past ~160 characters are truncated in results with an ellipsis, so a long
    // category blurb is cut at a word rather than mid-syllable.
    tag.content = truncateAtWord(description, 160);
    return () => {
      tag.content = previous;
    };
  }, [description]);

  useEffect(() => {
    if (!canonicalPath) return;

    // There is no canonical link in index.html — the SPA has no single canonical address — so this
    // creates one and takes it away again rather than leaving the last route's URL behind.
    const link = document.createElement('link');
    link.rel = 'canonical';
    link.href = new URL(canonicalPath, window.location.origin).toString();
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, [canonicalPath]);
}

function truncateAtWord(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, '')}…`;
}
