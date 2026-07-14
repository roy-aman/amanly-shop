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
    if (navigationType === 'POP') return; // browser restores back/forward scroll
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView();
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash, navigationType]);

  return null;
}
