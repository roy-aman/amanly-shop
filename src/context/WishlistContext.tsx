import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as wishlistApi from '@/api/wishlist';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

interface WishlistContextValue {
  /** The set of wishlisted product ids (empty when logged out). */
  ids: Set<string>;
  /** Number of wishlisted products (derived from `ids`). */
  count: number;
  /** True once the initial id load has settled (or been skipped when logged out). */
  ready: boolean;
  isWishlisted: (productId: string) => boolean;
  /**
   * Toggle a product's wishlist membership. Optimistic — the heart flips
   * immediately and rolls back on API failure. When the user is logged out it
   * redirects to /login (preserving the return path) instead of calling the API.
   */
  toggle: (productId: string) => Promise<void>;
  /** Re-read the wishlisted ids from the server (e.g. after a save-for-later). */
  refresh: () => Promise<void>;
}

const EMPTY_IDS: Set<string> = new Set();

// A non-throwing default so low-level consumers (ProductCard) can render outside a
// provider — e.g. in isolated component tests — as an inert outline heart. In the
// app the real provider is always mounted (see main.tsx), so real behavior applies.
const DEFAULT_VALUE: WishlistContextValue = {
  ids: EMPTY_IDS,
  count: 0,
  ready: false,
  isWishlisted: () => false,
  toggle: async () => {},
  refresh: async () => {},
};

const WishlistContext = createContext<WishlistContextValue>(DEFAULT_VALUE);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [ids, setIds] = useState<Set<string>>(() => new Set());
  const [ready, setReady] = useState(false);

  // Mirror `ids` in a ref so `toggle` reads the latest set without being recreated
  // on every change (it runs from click handlers, not render).
  const idsRef = useRef(ids);
  useEffect(() => {
    idsRef.current = ids;
  }, [ids]);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      // No wishlist calls when logged out — hearts are simply "off".
      setIds(new Set());
      setReady(true);
      return;
    }
    try {
      const list = await wishlistApi.getWishlistIds();
      setIds(new Set(list));
    } catch {
      // A transient error must not break card rendering; leave hearts "off".
      setIds(new Set());
    } finally {
      setReady(true);
    }
  }, [isAuthenticated]);

  // (Re)load whenever auth state changes; clears on logout.
  useEffect(() => {
    setReady(false);
    void refresh();
  }, [refresh]);

  const toggle = useCallback(
    async (productId: string) => {
      if (!isAuthenticated) {
        // Match the app-wide gated pattern (see components/guards.tsx): send the
        // user to /login with a `from` so they return to where they were.
        navigate('/login', { state: { from: location.pathname + location.search } });
        return;
      }
      const wasWishlisted = idsRef.current.has(productId);
      // Optimistic flip.
      setIds((prev) => {
        const next = new Set(prev);
        if (wasWishlisted) next.delete(productId);
        else next.add(productId);
        return next;
      });
      try {
        if (wasWishlisted) await wishlistApi.removeFromWishlist(productId);
        else await wishlistApi.addToWishlist(productId);
      } catch (e) {
        // Roll back so the UI never desyncs from the server.
        setIds((prev) => {
          const next = new Set(prev);
          if (wasWishlisted) next.add(productId);
          else next.delete(productId);
          return next;
        });
        toast.error('Could not update wishlist', e instanceof Error ? e.message : 'Please try again.');
      }
    },
    [isAuthenticated, navigate, location.pathname, location.search, toast],
  );

  const value = useMemo<WishlistContextValue>(
    () => ({
      ids,
      count: ids.size,
      ready,
      isWishlisted: (productId: string) => ids.has(productId),
      toggle,
      refresh,
    }),
    [ids, ready, toggle, refresh],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWishlist(): WishlistContextValue {
  return useContext(WishlistContext);
}
