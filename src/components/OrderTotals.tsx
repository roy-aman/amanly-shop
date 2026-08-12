import { Tag } from 'lucide-react';
import { money } from '@/lib/format';
import { orderTotals } from '@/lib/totals';
import { cn } from '@/components/ui';
import type { OrderResponse } from '@/lib/types';

/**
 * The money breakdown of a placed order, shared by the customer's order page and
 * the admin's.
 *
 * The tax line is where this earns its keep. When prices already include tax,
 * showing it as another row reads as an addition and makes the arithmetic look
 * wrong — so it becomes a note under the total instead. Every figure comes from
 * the order itself; nothing here is recomputed.
 */
export function OrderTotals({ order, className }: { order: OrderResponse; className?: string }) {
  const t = orderTotals(order);
  const c = order.currency;

  return (
    <dl className={cn('space-y-2 text-sm', className)}>
      <div className="flex items-center justify-between">
        <dt className="text-slate-400">Subtotal</dt>
        <dd className="text-slate-200">{money(t.subtotal, c)}</dd>
      </div>

      {t.discount > 0 && (
        <div className="flex items-center justify-between text-success-300">
          <dt className="flex items-center gap-1">
            <Tag className="h-3.5 w-3.5" aria-hidden /> Discount{order.couponCode ? ` (${order.couponCode})` : ''}
          </dt>
          <dd className="font-medium">−{money(t.discount, c)}</dd>
        </div>
      )}

      {t.hasShipping && (
        <div className="flex items-center justify-between">
          <dt className="text-slate-400">Delivery</dt>
          <dd className={t.shipping === 0 ? 'text-success-300' : 'text-slate-200'}>
            {t.shipping === 0 ? 'Free' : money(t.shipping, c)}
          </dd>
        </div>
      )}

      {t.hasTax && !t.taxInclusive && (
        <div className="flex items-center justify-between">
          <dt className="text-slate-400">Tax{t.taxRatePercent ? ` (${t.taxRatePercent}%)` : ''}</dt>
          <dd className="text-slate-200">{money(t.tax, c)}</dd>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-ink-700 pt-2 text-base font-bold">
        <span className="text-slate-300">Total</span>
        <span className="text-h3 text-slate-100">{money(t.total, c)}</span>
      </div>

      {t.hasTax && t.taxInclusive && (
        <p className="text-caption text-slate-500">
          Includes {money(t.tax, c)} tax{t.taxRatePercent ? ` at ${t.taxRatePercent}%` : ''}.
        </p>
      )}
    </dl>
  );
}
