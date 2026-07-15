import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Heart, ShoppingBag, Tag, Trash2, Undo2, X } from 'lucide-react';
import { addToCart, clearCart, removeCartItem, updateCartItem } from '@/api/cart';
import { addToWishlist } from '@/api/wishlist';
import { validateCoupon } from '@/api/coupons';
import { clearStoredCoupon, getStoredCoupon, setStoredCoupon } from '@/lib/couponStorage';
import type { CartItemResponse, CartResponse, CouponPreviewResponse } from '@/lib/types';
import { money } from '@/lib/format';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  ImageWithFallback,
  Input,
  LinkButton,
  PageHeader,
  QuantityStepper,
  Skeleton,
} from '@/components/ui';

// Reservations expire soon → warn once we're at/under this many minutes.
const RESERVATION_LOW_MINUTES = 5;
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

  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Your cart" />
        <EmptyState
          icon={<ShoppingBag className="h-10 w-10" />}
          title="Your cart is empty"
          message="Browse the catalog and add something you love — your picks will show up here."
          action={<LinkButton to="/products">Start shopping</LinkButton>}
        />
        {undoSnackbar()}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your cart"
        subtitle={`${items.length} item${items.length === 1 ? '' : 's'}`}
        action={
          <Button variant="ghost" size="sm" onClick={handleClear} loading={clearing} disabled={busyId != null}>
            <Trash2 className="h-4 w-4" /> Clear cart
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Line items ─────────────────────────────────────────────── */}
        <div className="space-y-3 lg:col-span-2">
          {items.map((item) => {
            const busy = busyId === item.cartItemId;
            const reservedMinutes =
              item.reservationRemainingMinutes != null
                ? Math.max(0, item.reservationRemainingMinutes - elapsedMinutes)
                : null;
            return (
              <Card key={item.cartItemId} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <Link
                  to={`/products/${item.productSlug}`}
                  className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/70"
                  aria-label={item.productName}
                >
                  <ImageWithFallback
                    alt={item.productName}
                    wrapperClassName="h-20 w-20 rounded-lg border border-ink-800"
                  />
                </Link>

                <div className="min-w-0 flex-1">
                  <Link
                    to={`/products/${item.productSlug}`}
                    className="font-semibold text-slate-100 transition hover:text-gold-300"
                  >
                    {item.productName}
                  </Link>
                  {item.variantOptionsLabel && (
                    <p className="mt-0.5 text-xs text-slate-300">{item.variantOptionsLabel}</p>
                  )}
                  <p className="text-xs text-slate-500">SKU: {item.variantSku ?? item.sku}</p>
                  <p className="mt-1 text-sm text-slate-400">{money(item.unitPrice, currency)} each</p>
                  {reservedMinutes != null && (
                    <div className="mt-2">
                      <Badge tone={reservedMinutes <= RESERVATION_LOW_MINUTES ? 'amber' : 'gray'}>
                        <Clock className="h-3 w-3" />
                        {reservedMinutes <= 0
                          ? 'Reservation expiring'
                          : `Reserved for ${reservedMinutes} min`}
                      </Badge>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <QuantityStepper
                    value={item.quantity}
                    onChange={(q) => changeQty(item, q)}
                    min={1}
                    max={99}
                    size="sm"
                    disabled={busy}
                    aria-label={`Quantity for ${item.productName}`}
                  />

                  <div className="w-24 text-right text-sm font-semibold text-slate-100">
                    {money(item.subtotal, currency)}
                  </div>

                  <button
                    type="button"
                    onClick={() => saveForLater(item)}
                    disabled={busy}
                    className="rounded-lg p-2 text-slate-500 transition hover:bg-ink-800 hover:text-gold-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/70 disabled:opacity-40"
                    aria-label={`Save ${item.productName} for later`}
                    title="Save for later"
                  >
                    <Heart className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => remove(item)}
                    disabled={busy}
                    className="rounded-lg p-2 text-slate-500 transition hover:bg-ink-800 hover:text-danger-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/70 disabled:opacity-40"
                    aria-label={`Remove ${item.productName}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>

        {/* ── Order summary ──────────────────────────────────────────── */}
        <aside>
          <Card className="space-y-4 p-5">
            <h2 className="text-sm font-semibold text-slate-200">Order summary</h2>

            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-400">Subtotal</dt>
                <dd className="font-medium text-slate-100">{money(cart?.totalAmount, currency)}</dd>
              </div>
              {appliedCoupon && (
                <div className="flex items-center justify-between text-success-300">
                  <dt className="flex items-center gap-1">
                    <Tag className="h-3.5 w-3.5" /> Discount ({appliedCoupon.code})
                  </dt>
                  <dd className="font-medium">−{money(discountAmount, currency)}</dd>
                </div>
              )}
              <div className="flex items-center justify-between">
                <dt className="text-slate-400">Shipping</dt>
                <dd className="text-slate-500">Calculated at checkout</dd>
              </div>
            </dl>

            {/* ── Coupon entry (WP-3.4) ─────────────────────────────────────
                Preview is advisory (always HTTP 200 — read `valid`); the real
                discount is recomputed at placement. Applied code is persisted so
                Checkout can carry it into placeOrder. */}
            <div className="border-t border-ink-800 pt-4">
              {appliedCoupon ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-success-500/30 bg-success-500/10 px-3 py-2.5 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-success-300">
                    <Tag className="h-4 w-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="font-semibold">{appliedCoupon.code}</span> applied
                      <span className="block text-xs text-success-400/90">
                        You save {money(discountAmount, currency)}
                      </span>
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={removeCoupon}
                    className="rounded-lg p-1.5 text-success-300 transition hover:bg-success-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/70"
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
                      variant="secondary"
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
                <p className="mt-2 text-xs text-danger-300" role="alert">
                  {preview.message}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-ink-800 pt-4 text-base font-bold">
              <span className="text-slate-300">Total</span>
              <span className="text-gold-300">{money(payableTotal, currency)}</span>
            </div>
            <p className="-mt-2 text-xs text-slate-500">Shipping &amp; taxes calculated at checkout.</p>

            <LinkButton to="/checkout" fullWidth size="lg">
              Proceed to checkout
            </LinkButton>
            <LinkButton to="/products" variant="ghost" fullWidth>
              Continue shopping
            </LinkButton>
          </Card>
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
        <div className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-ink-700 bg-ink-850/95 p-3 pl-4 shadow-lift backdrop-blur">
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
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="h-20 w-20 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-9 w-28" />
            </Card>
          ))}
        </div>
        <Card className="space-y-4 p-5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </Card>
      </div>
    </div>
  );
}
