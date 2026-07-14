import { useEffect } from 'react';

/** Brand prefix for every page title, e.g. `Royal Commerce — Products`. */
export const TITLE_BASE = 'Royal Commerce';

/**
 * Sets `document.title` for the lifetime of the calling component. Pass a page
 * name to get `Royal Commerce — <name>`; pass nothing/falsy (e.g. while data is
 * still loading) to fall back to the bare brand so the tab never flashes
 * "undefined". The title is not restored on unmount — the next route sets its own.
 *
 * Phase 2 pages set dynamic titles the same way, e.g.
 * `useDocumentTitle(product?.name ?? 'Product')`.
 */
export function useDocumentTitle(title?: string | null): void {
  useEffect(() => {
    document.title = title ? `${TITLE_BASE} — ${title}` : TITLE_BASE;
  }, [title]);
}

/**
 * Declarative form of {@link useDocumentTitle} for wiring static titles at the
 * route level. Renders nothing.
 */
export function RouteTitle({ title }: { title?: string | null }): null {
  useDocumentTitle(title);
  return null;
}
