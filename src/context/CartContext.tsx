import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as cartApi from '@/api/cart';
import type { CartItemResponse, CartResponse } from '@/lib/types';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

interface CartContextValue {
  cart: CartResponse | null;
  itemCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  setCart: (cart: CartResponse | null) => void;
  /**
   * The bag line for a product, or null when it is not in the bag. Variantless lines only — a
   * variant product is bought from its own page, where the chosen variant is known.
   */
  lineFor: (productId: string) => CartItemResponse | null;
  /**
   * Add a variantless product to the bag. Auth-gated: a logged-out shopper is sent to /login
   * (return path preserved) rather than shown a 401. Announces success and failure itself.
   * Resolves true when the bag actually changed.
   */
  addProduct: (productId: string, quantity: number, productName: string) => Promise<boolean>;
  /**
   * Set the absolute quantity of a variantless line, removing it at zero. Announces failures.
   * Resolves true when the bag actually changed.
   */
  setProductQuantity: (productId: string, quantity: number, productName: string) => Promise<boolean>;
}

const INERT: CartContextValue = {
  cart: null,
  itemCount: 0,
  loading: false,
  refresh: async () => {},
  setCart: () => {},
  lineFor: () => null,
  addProduct: async () => false,
  setProductQuantity: async () => false,
};

/**
 * A non-throwing default, for the same reason WishlistContext has one: leaf components now carry
 * bag controls (ProductCard), and they must still render outside a provider — in isolated
 * component tests — as inert. In the app the real provider is always mounted (see main.tsx), so
 * real behaviour always applies.
 */
const CartContext = createContext<CartContextValue>(INERT);

export function CartProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [cart, setCartState] = useState<CartResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setCartState(null);
      return;
    }
    setLoading(true);
    try {
      setCartState(await cartApi.getCart());
    } catch {
      // A missing/empty cart or transient error shouldn't break the chrome.
      setCartState(null);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const itemCount = useMemo(
    () => (cart?.items ?? []).reduce((sum, i) => sum + i.quantity, 0),
    [cart],
  );

  const lineFor = useCallback(
    (productId: string) =>
      (cart?.items ?? []).find((i) => i.productId === productId && !i.variantId) ?? null,
    [cart],
  );

  const addProduct = useCallback(
    async (productId: string, quantity: number, productName: string) => {
      // The app-wide gated pattern (components/guards.tsx, WishlistContext.toggle): send a
      // logged-out shopper to /login with a `from` so they land back where they were.
      if (!isAuthenticated) {
        navigate('/login', { state: { from: location.pathname + location.search } });
        return false;
      }
      try {
        setCartState(await cartApi.addToCart(productId, quantity));
        toast.success('Added to bag', `${quantity} × ${productName}`);
        return true;
      } catch (e) {
        toast.error('Could not add to bag', e instanceof Error ? e.message : 'Please try again.');
        return false;
      }
    },
    [isAuthenticated, navigate, location.pathname, location.search, toast],
  );

  const setProductQuantity = useCallback(
    async (productId: string, quantity: number, productName: string) => {
      try {
        setCartState(
          quantity <= 0
            ? await cartApi.removeCartItem(productId)
            : await cartApi.updateCartItem(productId, quantity),
        );
        if (quantity <= 0) toast.info('Removed from bag', productName);
        return true;
      } catch (e) {
        // Re-read rather than guess. The server is the only thing that knows what the bag holds
        // now, and a stale local line is exactly what produces a control that keeps failing.
        await refresh();
        toast.error('Could not update bag', e instanceof Error ? e.message : 'Please try again.');
        return false;
      }
    },
    [refresh, toast],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      itemCount,
      loading,
      refresh,
      setCart: setCartState,
      lineFor,
      addProduct,
      setProductQuantity,
    }),
    [cart, itemCount, loading, refresh, lineFor, addProduct, setProductQuantity],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart(): CartContextValue {
  return useContext(CartContext);
}
