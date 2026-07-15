import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, ShoppingBag, Trash2, Undo2 } from 'lucide-react';
import { addToCart, clearCart, removeCartItem, updateCartItem } from '@/api/cart';
import type { CartResponse } from '@/lib/types';
import { money } from '@/lib/format';
import { useCart } from '@/context/CartContext';
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
  quantity: number;
  productName: string;
}

/**
 * Recompute a cart locally so a quantity change reflects instantly (optimistic).
 * The server response later replaces this wholesale, so this only needs to be a
 * plausible interim view — line subtotal = unitPrice × qty, total = Σ subtotals.
 */
function withOptimisticQuantity(cart: CartResponse, productId: string, quantity: number): CartResponse {
  const items = cart.items.map((it) =>
    it.productId === productId ? { ...it, quantity, subtotal: it.unitPrice * quantity } : it,
  );
  return { ...cart, items, totalAmount: items.reduce((sum, it) => sum + it.subtotal, 0) };
}

export default function Cart() {
  useDocumentTitle('Cart');
  const { cart, loading, refresh, setCart } = useCart();
  const toast = useToast();

  // Per-product in-flight guard: disables that row's controls to prevent
  // double-submits and keeps the optimistic view from racing the server.
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

  async function changeQty(productId: string, quantity: number, current: number) {
    if (!cart || quantity < 1 || quantity === current) return;
    setBusyId(productId);
    // Optimistic: show the new quantity immediately…
    setCart(withOptimisticQuantity(cart, productId, quantity));
    try {
      // …then reconcile with the authoritative cart the mutation returns.
      const updated = await updateCartItem(productId, quantity);
      setCart(updated);
    } catch (e) {
      // Roll back to server truth so the UI can never drift out of sync.
      await refresh();
      toast.error('Could not update item', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(productId: string, quantity: number, productName: string) {
    setBusyId(productId);
    try {
      const updated = await removeCartItem(productId);
      setCart(updated);
      setUndo({ productId, quantity, productName });
    } catch (e) {
      await refresh();
      toast.error('Could not remove item', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleUndo() {
    if (!undo) return;
    setUndoing(true);
    try {
      const updated = await addToCart(undo.productId, undo.quantity);
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
            const busy = busyId === item.productId;
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
                  <p className="text-xs text-slate-500">SKU: {item.sku}</p>
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
                    onChange={(q) => changeQty(item.productId, q, item.quantity)}
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
                    onClick={() => remove(item.productId, item.quantity, item.productName)}
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
              <div className="flex items-center justify-between">
                <dt className="text-slate-400">Shipping</dt>
                <dd className="text-slate-500">Calculated at checkout</dd>
              </div>
            </dl>

            {/* Coupon input is intentionally inert — the coupon backend ships in
                WP-3.4. Rendered disabled with a "coming soon" hint; no endpoint. */}
            <div className="border-t border-ink-800 pt-4">
              <Field label="Promo code" hint="Coupon codes are coming soon.">
                <div className="flex gap-2">
                  <Input placeholder="Enter code" disabled aria-label="Promo code (coming soon)" />
                  <Button variant="secondary" disabled>
                    Apply
                  </Button>
                </div>
              </Field>
            </div>

            <div className="flex items-center justify-between border-t border-ink-800 pt-4 text-base font-bold">
              <span className="text-slate-300">Total</span>
              <span className="text-gold-300">{money(cart?.totalAmount, currency)}</span>
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
