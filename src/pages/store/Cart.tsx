import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { updateCartItem, removeCartItem, clearCart } from '@/api/cart';
import { money } from '@/lib/format';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import { Button, Card, EmptyState, LinkButton, PageHeader, PageLoader, Spinner } from '@/components/ui';

export default function Cart() {
  const { cart, loading, refresh } = useCart();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  async function changeQty(productId: string, quantity: number) {
    if (quantity < 1) return;
    setBusyId(productId);
    try {
      await updateCartItem(productId, quantity);
      await refresh();
    } catch (e) {
      toast.error('Could not update item', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(productId: string) {
    setBusyId(productId);
    try {
      await removeCartItem(productId);
      await refresh();
    } catch (e) {
      toast.error('Could not remove item', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleClear() {
    setClearing(true);
    try {
      await clearCart();
      await refresh();
      toast.success('Cart cleared');
    } catch (e) {
      toast.error('Could not clear cart', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setClearing(false);
    }
  }

  if (loading && !cart) return <PageLoader />;

  const items = cart?.items ?? [];
  const currency = cart?.currency ?? 'USD';

  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Your cart" />
        <EmptyState
          icon={<ShoppingBag className="h-10 w-10" />}
          title="Your cart is empty"
          message="Browse the catalog and add something you love."
          action={<LinkButton to="/products">Start shopping</LinkButton>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your cart"
        subtitle={`${items.length} item${items.length === 1 ? '' : 's'}`}
        action={
          <Button variant="ghost" size="sm" onClick={handleClear} loading={clearing}>
            <Trash2 className="h-4 w-4" /> Clear cart
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {items.map((item) => {
            const busy = busyId === item.productId;
            return (
              <Card key={item.cartItemId} className="flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <Link to={`/products/${item.productSlug}`} className="font-semibold text-slate-100 hover:text-gold-300">
                    {item.productName}
                  </Link>
                  <p className="text-xs text-slate-500">SKU: {item.sku}</p>
                  <p className="mt-1 text-sm text-slate-400">{money(item.unitPrice, currency)} each</p>
                  {item.reservationRemainingMinutes != null && (
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-amber-300">
                      <Clock className="h-3 w-3" /> reserved {item.reservationRemainingMinutes}m
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex h-9 items-center rounded-lg border border-ink-700 bg-ink-900">
                    <button
                      onClick={() => changeQty(item.productId, item.quantity - 1)}
                      disabled={busy || item.quantity <= 1}
                      className="grid h-full w-8 place-items-center text-slate-300 hover:text-slate-100 disabled:opacity-40"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm text-slate-100">
                      {busy ? <Spinner className="mx-auto h-3.5 w-3.5" /> : item.quantity}
                    </span>
                    <button
                      onClick={() => changeQty(item.productId, item.quantity + 1)}
                      disabled={busy}
                      className="grid h-full w-8 place-items-center text-slate-300 hover:text-slate-100 disabled:opacity-40"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="w-24 text-right text-sm font-semibold text-slate-100">
                    {money(item.subtotal, currency)}
                  </div>

                  <button
                    onClick={() => remove(item.productId)}
                    disabled={busy}
                    className="rounded-lg p-2 text-slate-500 hover:bg-ink-800 hover:text-rose-400 disabled:opacity-40"
                    aria-label="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Totals */}
        <div>
          <Card className="space-y-4 p-5">
            <h2 className="text-sm font-semibold text-slate-200">Order summary</h2>
            <div className="flex items-center justify-between border-t border-ink-800 pt-4 text-base font-bold">
              <span className="text-slate-300">Total</span>
              <span className="text-gold-300">{money(cart?.totalAmount, currency)}</span>
            </div>
            <LinkButton to="/checkout" fullWidth size="lg">
              Proceed to checkout
            </LinkButton>
            <LinkButton to="/products" variant="ghost" fullWidth>
              Continue shopping
            </LinkButton>
          </Card>
        </div>
      </div>
    </div>
  );
}
