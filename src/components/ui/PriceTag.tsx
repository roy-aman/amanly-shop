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
      {/* The price is the loudest text in the card, so it takes the strongest
          ink rather than a colour. Gold pricing reads discount-store, and on
          white it could not clear AA anyway. */}
      <span className={cn('font-semibold text-slate-100', priceSize)}>{money(price, currency)}</span>
      {onSale && (
        <>
          <span className={cn('text-slate-500 line-through', compareSize)}>{money(compareAtPrice, currency)}</span>
          {showDiscountBadge && (
            // A quiet text mark, not a pill: a filled badge next to a struck
            // price is two loud signals for one fact.
            <span className={cn('font-semibold text-danger-300', compareSize)}>−{discountPct}%</span>
          )}
        </>
      )}
    </div>
  );
}
