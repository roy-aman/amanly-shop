import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Scroll restoration for the SPA. The layout shells (StoreLayout/AdminLayout)
 * persist across route changes and never unmount, so the browser does not reset
 * scroll on navigation — this does it explicitly.
 *
 * Rules:
 * - On PUSH/REPLACE navigations, jump to the top of the page.
 * - On POP (browser back/forward), do nothing and let the browser restore the
 *   previous scroll position (`history.scrollRestoration` defaults to 'auto').
 * - When the URL carries a `#hash`, defer to native in-page anchor behavior.
 *
 * Mount once, inside the Router but above <Routes>.
 */
export default function ScrollToTop(): null {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (navigationType === 'POP') return; // browser restores back/forward scroll
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView();
        return;
      }
    }
    // `behavior: 'instant'` is load-bearing, not a default spelled out.
    // `html { scroll-behavior: smooth }` (index.css) makes in-page anchors ease,
    // but it also captures programmatic scrolls — without this override, landing
    // on a new route from halfway down a long catalogue would slowly glide back
    // to the top while the new page is already rendering.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, hash, navigationType]);

  return null;
}
