import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, Heart, ShoppingBag, Tag, Trash2, Undo2, X } from 'lucide-react';
import { addToCart, clearCart, removeCartItem, updateCartItem } from '@/api/cart';
import { getPublicStore } from '@/api/store';
import { addToWishlist } from '@/api/wishlist';
import { validateCoupon } from '@/api/coupons';
import { clearStoredCoupon, getStoredCoupon, setStoredCoupon } from '@/lib/couponStorage';
import type { CartItemResponse, CartResponse, CouponPreviewResponse } from '@/lib/types';
import { money } from '@/lib/format';
import { amountToFreeShipping, estimateCartTotals } from '@/lib/totals';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  ImageWithFallback,
  Input,
  LinkButton,
  QuantityStepper,
  Skeleton,
} from '@/components/ui';

// Reservations expire soon → warn once we're at/under this many minutes.
// How long the undo affordance stays available after a remove.
const UNDO_WINDOW_MS = 6000;

interface UndoState {
  productId: string;
  variantId: string | null;
  quantity: number;
  productName: string;
}

/**
 * Recompute a cart locally so a quantity change reflects instantly (optimistic).
 * The server response later replaces this wholesale, so this only needs to be a
 * plausible interim view — line subtotal = unitPrice × qty, total = Σ subtotals.
 * Keyed by cartItemId so variant lines of the same product stay independent.
 */
function withOptimisticQuantity(cart: CartResponse, cartItemId: string, quantity: number): CartResponse {
  const items = cart.items.map((it) =>
    it.cartItemId === cartItemId ? { ...it, quantity, subtotal: it.unitPrice * quantity } : it,
  );
  return { ...cart, items, totalAmount: items.reduce((sum, it) => sum + it.subtotal, 0) };
}

export default function Cart() {
  useDocumentTitle('Cart');
  const { cart, loading, refresh, setCart } = useCart();
  const { refresh: refreshWishlist } = useWishlist();
  const toast = useToast();
  // Shipping and tax rules for the pre-checkout estimate. Shares the cache key
  // used across the app, so this rarely costs a request.
  const storeQuery = useQuery({ queryKey: ['public-store'], queryFn: getPublicStore, staleTime: 5 * 60_000 });

  // Per-line in-flight guard (keyed by cartItemId — a product can appear as several
  // variant lines): disables that row's controls to prevent double-submits and keeps
  // the optimistic view from racing the server.
  const [busyId, setBusyId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [undoing, setUndoing] = useState(false);

  // Reservation countdown: the server value is minutes-remaining truth. We seed
  // a client clock from it and tick the display down between refreshes for UX;
  // any cart refresh re-seeds `seededAt`, so the server value always wins.
  const [now, setNow] = useState(() => Date.now());
  const seededAt = useRef(Date.now());
  useEffect(() => {
    seededAt.current = Date.now();
    setNow(Date.now());
  }, [cart]);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Auto-dismiss the undo affordance after its window elapses.
  useEffect(() => {
    if (!undo) return;
    const id = window.setTimeout(() => setUndo(null), UNDO_WINDOW_MS);
    return () => window.clearTimeout(id);
  }, [undo]);

  // ── Coupon entry ──────────────────────────────────────────────────────
  // `activeCode` is the code we're previewing (seeded from a persisted apply so
  // it survives navigation). A single effect validates it against the CURRENT
  // cart subtotal — so it re-checks automatically when quantities change — and
  // mirrors the result into `preview`. The preview is advisory; the real discount
  // is recomputed server-side at placement.
  const [activeCode, setActiveCode] = useState<string | null>(() => getStoredCoupon());
  const [couponInput, setCouponInput] = useState('');
  const [preview, setPreview] = useState<CouponPreviewResponse | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);

  const cartSubtotal = cart?.totalAmount;
  useEffect(() => {
    if (!activeCode || cartSubtotal == null) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setCouponBusy(true);
    validateCoupon(activeCode, cartSubtotal)
      .then((res) => {
        if (cancelled) return;
        setPreview(res);
        // Persist only a valid code; drop a now-invalid one from storage so it
        // never rides along to checkout (placement would reject the whole order).
        if (res.valid) setStoredCoupon(res.code);
        else clearStoredCoupon();
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      })
      .finally(() => {
        if (!cancelled) setCouponBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeCode, cartSubtotal]);

  function applyCoupon() {
    const code = couponInput.trim();
    if (!code || couponBusy) return;
    setActiveCode(code);
    setCouponInput('');
  }

  function removeCoupon() {
    setActiveCode(null);
    setPreview(null);
    setCouponInput('');
    clearStoredCoupon();
  }

  async function changeQty(item: CartItemResponse, quantity: number) {
    if (!cart || quantity < 1 || quantity === item.quantity) return;
    setBusyId(item.cartItemId);
    // Optimistic: show the new quantity immediately…
    setCart(withOptimisticQuantity(cart, item.cartItemId, quantity));
    try {
      // …then reconcile with the authoritative cart the mutation returns.
      const updated = await updateCartItem(item.productId, quantity, item.variantId ?? undefined);
      setCart(updated);
    } catch (e) {
      // Roll back to server truth so the UI can never drift out of sync.
      await refresh();
      toast.error('Could not update item', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(item: CartItemResponse) {
    setBusyId(item.cartItemId);
    try {
      const updated = await removeCartItem(item.productId, item.variantId ?? undefined);
      setCart(updated);
      setUndo({
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
        productName: item.productName,
      });
    } catch (e) {
      await refresh();
      toast.error('Could not remove item', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  // "Save for later" = move the line to the wishlist. There is no combined
  // backend endpoint, so this is two calls: add to wishlist, then remove the cart
  // line. If the wishlist add fails we keep the item in the cart (nothing moved).
  // If the add succeeds but the cart remove fails, the item is safely on the
  // wishlist and still in the cart — we say so rather than silently swallowing it.
  async function saveForLater(item: CartItemResponse) {
    const { productId, productName } = item;
    setBusyId(item.cartItemId);
    try {
      await addToWishlist(productId);
    } catch (e) {
      toast.error('Could not save for later', e instanceof Error ? e.message : 'Please try again.');
      setBusyId(null);
      return;
    }
    try {
      const updated = await removeCartItem(productId, item.variantId ?? undefined);
      setCart(updated);
      void refreshWishlist(); // keep heart state in sync across the app
      toast.success('Saved for later', `${productName} moved to your wishlist.`);
    } catch (e) {
      void refreshWishlist();
      await refresh();
      toast.warning(
        'Saved to your wishlist',
        `But we couldn't remove ${productName} from your cart — try removing it again.`,
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleUndo() {
    if (!undo) return;
    setUndoing(true);
    try {
      const updated = await addToCart(undo.productId, undo.quantity, undo.variantId ?? undefined);
      setCart(updated);
      setUndo(null);
    } catch (e) {
      await refresh();
      toast.error('Could not undo', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setUndoing(false);
    }
  }

  async function handleClear() {
    setClearing(true);
    try {
      await clearCart();
      await refresh();
      setUndo(null);
      toast.success('Cart cleared');
    } catch (e) {
      toast.error('Could not clear cart', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setClearing(false);
    }
  }

  if (loading && !cart) return <CartSkeleton />;

  const items = cart?.items ?? [];
  const currency = cart?.currency ?? 'USD';
  const elapsedMinutes = Math.floor((now - seededAt.current) / 60_000);

  // Applied (valid) coupon → drives the discount row + adjusted total. A rejected
  // preview stays in `preview` (message shown) but never affects the totals.
  const appliedCoupon = preview?.valid ? preview : null;
  const discountAmount = appliedCoupon?.discountAmount ?? 0;
  const payableTotal = appliedCoupon?.total ?? cart?.totalAmount;

  // Estimated delivery and tax, from the store's published rules. There is no
  // totals-preview endpoint, so this is the storefront doing the arithmetic —
  // null when the store has not published the rules, which keeps the panel
  // honest instead of guessing. The placed order is what actually counts.
  const estimate = estimateCartTotals(cart?.totalAmount ?? 0, discountAmount, storeQuery.data);
  const toFreeShipping = amountToFreeShipping((cart?.totalAmount ?? 0) - discountAmount, storeQuery.data);

  if (items.length === 0) {
    return (
      <div>
        <h1 className="border-b border-ink-700 pb-6 font-display text-h1 text-slate-100">Your bag</h1>
        <div className="py-16">
          <EmptyState
            icon={<ShoppingBag className="h-10 w-10" />}
            title="Your bag is empty"
            message="Everything you add will show up here."
            action={<LinkButton to="/products">Start shopping</LinkButton>}
          />
        </div>
        {undoSnackbar()}
      </div>
    );
  }

  return (
    <div>
      <header className="flex items-end justify-between gap-4 border-b border-ink-700 pb-6">
        <div>
          <h1 className="font-display text-h1 text-slate-100">Your bag</h1>
          <p className="mt-2 text-body-sm text-slate-400">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </p>
        </div>
        {/* Destructive, so it stays a quiet text control rather than a button
            sitting at the same weight as Checkout. */}
        <button
          type="button"
          onClick={handleClear}
          disabled={clearing || busyId != null}
          className="rounded text-body-sm text-slate-500 underline-offset-4 transition hover:text-slate-100 hover:underline disabled:opacity-50"
        >
          Clear bag
        </button>
      </header>

      <div className="mt-10 grid grid-cols-1 gap-12 lg:grid-cols-[1fr_22rem]">
        {/* ── Line items ─────────────────────────────────────────────── */}
        <div className="divide-y divide-ink-700 border-b border-ink-700">
          {items.map((item) => {
            const busy = busyId === item.cartItemId;
            const reservedMinutes =
              item.reservationRemainingMinutes != null
                ? Math.max(0, item.reservationRemainingMinutes - elapsedMinutes)
                : null;
            return (
              <div key={item.cartItemId} className="flex gap-5 py-6 first:pt-0">
                <Link
                  to={`/products/${item.productSlug}`}
                  className="shrink-0 focus:outline-none focus-visible:outline-none"
                  aria-label={item.productName}
                >
                  <ImageWithFallback alt={item.productName} wrapperClassName="h-28 w-24 bg-ink-850" />
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Link
                        to={`/products/${item.productSlug}`}
                        className="text-body-sm font-medium text-slate-100 transition hover:text-slate-400"
                      >
                        {item.productName}
                      </Link>
                      {item.variantOptionsLabel && (
                        <p className="mt-1 text-caption text-slate-400">{item.variantOptionsLabel}</p>
                      )}
                      <p className="mt-0.5 text-caption text-slate-500">
                        SKU: {item.variantSku ?? item.sku}
                      </p>
                      <p className="mt-1.5 text-body-sm text-slate-400">
                        {money(item.unitPrice, currency)} each
                      </p>
                    </div>
                    <span className="shrink-0 text-body-sm font-semibold text-slate-100">
                      {money(item.subtotal, currency)}
                    </span>
                  </div>

                  {/* A reassurance, never a countdown to losing the item. The hold on stock does
                      lapse after fifteen minutes, but the line stays in the bag either way — the
                      sweeper releases the reservation and leaves the bag alone — so this badge
                      simply goes away when the hold does. Amber and "expiring" are gone with it:
                      nothing bad happens at zero, and a warning that resolves into nothing teaches
                      shoppers to distrust the next one. */}
                  {reservedMinutes != null && reservedMinutes > 0 && (
                    <div className="mt-3">
                      <Badge tone="gray">
                        <Clock className="h-3 w-3" />
                        Stock held for {reservedMinutes} min
                      </Badge>
                    </div>
                  )}

                  <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-3 pt-4">
                    <QuantityStepper
                      value={item.quantity}
                      onChange={(q) => changeQty(item, q)}
                      min={1}
                      max={99}
                      size="sm"
                      disabled={busy}
                      aria-label={`Quantity for ${item.productName}`}
                    />

                    {/* Text actions, not icon buttons: on a light row, two grey
                        glyphs read as decoration and get missed. */}
                    <button
                      type="button"
                      onClick={() => saveForLater(item)}
                      disabled={busy}
                      className="flex items-center gap-1.5 rounded text-caption text-slate-500 transition hover:text-slate-100 disabled:opacity-40"
                      aria-label={`Save ${item.productName} for later`}
                    >
                      <Heart className="h-3.5 w-3.5" aria-hidden /> Save for later
                    </button>

                    <button
                      type="button"
                      onClick={() => remove(item)}
                      disabled={busy}
                      className="flex items-center gap-1.5 rounded text-caption text-slate-500 transition hover:text-danger-300 disabled:opacity-40"
                      aria-label={`Remove ${item.productName}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Order summary ──────────────────────────────────────────── */}
        {/* The one place a filled panel earns its keep: the totals need to read
            as a single settled block, and it stays in view while items scroll. */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-2xl border border-ink-700 bg-ink-900 p-6 shadow-card">
            <h2 className="text-overline uppercase text-slate-500">Summary</h2>

            <dl className="mt-5 space-y-3 text-body-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-400">Subtotal</dt>
                <dd className="text-slate-100">{money(cart?.totalAmount, currency)}</dd>
              </div>
              {appliedCoupon && (
                <div className="flex items-center justify-between text-success-300">
                  <dt className="flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5" /> Discount ({appliedCoupon.code})
                  </dt>
                  <dd className="font-medium">−{money(discountAmount, currency)}</dd>
                </div>
              )}
              <div className="flex items-center justify-between">
                <dt className="text-slate-400">Delivery</dt>
                <dd className={estimate?.shipping === 0 ? 'text-success-300' : 'text-slate-100'}>
                  {estimate ? (estimate.shipping === 0 ? 'Free' : money(estimate.shipping, currency)) : (
                    <span className="text-slate-500">Calculated at checkout</span>
                  )}
                </dd>
              </div>
              {estimate?.hasTax && !estimate.taxInclusive && (
                <div className="flex items-center justify-between">
                  <dt className="text-slate-400">Tax ({estimate.taxRatePercent}%)</dt>
                  <dd className="text-slate-100">{money(estimate.tax, currency)}</dd>
                </div>
              )}
            </dl>

            {/* "Spend X more" only appears when it is actually reachable —
                a threshold the cart has already cleared is not news. */}
            {toFreeShipping != null && (
              <p className="mt-4 border border-ink-600 px-3 py-2 text-caption text-slate-300">
                Add {money(toFreeShipping, currency)} more for free delivery.
              </p>
            )}

            {/* ── Coupon entry (WP-3.4) ─────────────────────────────────────
                Preview is advisory (always HTTP 200 — read `valid`); the real
                discount is recomputed at placement. Applied code is persisted so
                Checkout can carry it into placeOrder. */}
            <div className="mt-6 border-t border-ink-600 pt-6">
              {appliedCoupon ? (
                <div className="flex items-center justify-between gap-2 border border-success-500/30 bg-success-500/10 px-3 py-2.5 text-body-sm">
                  <span className="flex min-w-0 items-center gap-2 text-success-300">
                    <Tag className="h-4 w-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="font-semibold">{appliedCoupon.code}</span> applied
                      <span className="block text-caption">You save {money(discountAmount, currency)}</span>
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={removeCoupon}
                    className="rounded p-1.5 text-success-300 transition hover:bg-success-500/15 focus:outline-none focus-visible:outline-none"
                    aria-label={`Remove coupon ${appliedCoupon.code}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <Field label="Promo code">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter code"
                      aria-label="Promo code"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          applyCoupon();
                        }
                      }}
                      invalid={!!preview && !preview.valid}
                      disabled={couponBusy}
                    />
                    <Button
                      variant="outline"
                      onClick={applyCoupon}
                      loading={couponBusy}
                      disabled={!couponInput.trim()}
                    >
                      Apply
                    </Button>
                  </div>
                </Field>
              )}
              {preview && !preview.valid && (
                <p className="mt-2 text-caption text-danger-300" role="alert">
                  {preview.message}
                </p>
              )}
            </div>

            <div className="mt-6 flex items-baseline justify-between border-t border-ink-600 pt-6">
              <span className="text-body-sm text-slate-400">{estimate ? 'Estimated total' : 'Total'}</span>
              <span className="text-h3 text-slate-100">{money(estimate?.total ?? payableTotal, currency)}</span>
            </div>
            <p className="mt-2 text-caption text-slate-500">
              {estimate
                ? estimate.taxInclusive && estimate.hasTax
                  ? `Includes ${money(estimate.tax, currency)} tax. Confirmed at checkout.`
                  : 'Confirmed at checkout.'
                : 'Shipping & taxes calculated at checkout.'}
            </p>

            <div className="mt-6 space-y-3">
              <LinkButton to="/checkout" fullWidth size="xl">
                Checkout
              </LinkButton>
              <LinkButton to="/products" variant="ghost" fullWidth>
                Continue shopping
              </LinkButton>
            </div>
          </div>
        </aside>
      </div>

      {undoSnackbar()}
    </div>
  );

  // Undo snackbar. ToastContext exposes no action button (only success/error/
  // info/warning/push, 5s auto-dismiss), so the undo affordance is an in-page
  // snackbar with role="status" rather than an actionable toast.
  function undoSnackbar() {
    if (!undo) return null;
    return (
      <div
        role="status"
        className="fixed inset-x-0 bottom-6 z-toast flex justify-center px-4"
      >
        <div className="pointer-events-auto flex w-full max-w-sm items-center gap-3 border border-ink-700 bg-ink-950 p-3 pl-4 shadow-lift">
          <p className="min-w-0 flex-1 truncate text-sm text-slate-200">
            Removed <span className="font-medium text-slate-100">{undo!.productName}</span>
          </p>
          <Button size="sm" variant="secondary" onClick={handleUndo} loading={undoing}>
            <Undo2 className="h-4 w-4" /> Undo
          </Button>
        </div>
      </div>
    );
  }
}

function CartSkeleton() {
  return (
    <div>
      <Skeleton className="h-9 w-40" />
      <div className="mt-10 grid grid-cols-1 gap-12 lg:grid-cols-[1fr_22rem]">
        <div className="divide-y divide-ink-700 border-b border-ink-700">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-5 py-6 first:pt-0">
              <Skeleton className="h-28 w-24 rounded-none" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/4" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="mt-4 h-9 w-28" />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-4 bg-ink-850 p-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
