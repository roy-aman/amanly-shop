import { money } from '@/lib/format';
import { cn } from './cn';

/**
 * PriceTag — renders a price with an optional strike-through compare-at price
 * and a computed discount-% badge. The compare-at + badge only show when
 * `compareAtPrice` is present and strictly greater than `price`.
 */
export function PriceTag({
  price,
  compareAtPrice,
  currency = 'USD',
  size = 'md',
  showDiscountBadge = true,
  className,
}: {
  price: number;
  compareAtPrice?: number | null;
  currency?: string;
  size?: 'sm' | 'md' | 'lg';
  showDiscountBadge?: boolean;
  className?: string;
}) {
  const onSale = compareAtPrice != null && compareAtPrice > price;
  const discountPct = onSale ? Math.round(((compareAtPrice! - price) / compareAtPrice!) * 100) : 0;

  const priceSize = size === 'lg' ? 'text-h2' : size === 'sm' ? 'text-sm' : 'text-base';
  const compareSize = size === 'lg' ? 'text-sm' : 'text-xs';

  return (
    <div className={cn('flex flex-wrap items-baseline gap-2', className)}>
      <span className={cn('font-bold text-gold-300', priceSize)}>{money(price, currency)}</span>
      {onSale && (
        <>
          <span className={cn('text-slate-500 line-through', compareSize)}>{money(compareAtPrice, currency)}</span>
          {showDiscountBadge && (
            <span
              className={cn(
                'inline-flex items-center rounded-full border border-success-500/30 bg-success-500/15 px-2 py-0.5 font-semibold text-success-300',
                compareSize,
              )}
            >
              −{discountPct}%
            </span>
          )}
        </>
      )}
    </div>
  );
}
