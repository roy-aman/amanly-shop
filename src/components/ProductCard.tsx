import { Link } from 'react-router-dom';
import { ImageOff } from 'lucide-react';
import type { ProductSummaryResponse } from '@/lib/types';
import { money } from '@/lib/format';
import { Badge } from '@/components/ui';

/** Layout variants: the default square-tile grid card, and a horizontal list row. */
export type ProductCardVariant = 'grid' | 'list';

/**
 * Reusable catalog card for a product summary. Links to the product detail page.
 * `variant` toggles between the square grid tile (default — consumed by Home) and
 * a horizontal list row for the PLP list view. The default is unchanged, so all
 * existing call sites keep their exact layout.
 */
export default function ProductCard({
  product,
  variant = 'grid',
}: {
  product: ProductSummaryResponse;
  variant?: ProductCardVariant;
}) {
  const outOfStock = product.stockQuantity <= 0;
  const hasCompare = product.compareAtPrice != null && product.compareAtPrice > product.price;

  const image = product.primaryImageUrl ? (
    <img
      src={product.primaryImageUrl}
      alt={product.name}
      loading="lazy"
      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center text-slate-600">
      <ImageOff className="h-10 w-10" />
    </div>
  );

  const price = (
    <div className="flex items-baseline gap-2">
      <span className="text-base font-bold text-gold-300">{money(product.price, product.currency)}</span>
      {hasCompare && (
        <span className="text-xs text-slate-500 line-through">{money(product.compareAtPrice, product.currency)}</span>
      )}
    </div>
  );

  if (variant === 'list') {
    return (
      <Link
        to={`/products/${product.slug}`}
        className="group flex gap-4 overflow-hidden rounded-2xl border border-ink-800 bg-ink-900/60 p-3 transition hover:border-ink-600 hover:shadow-lift"
      >
        <div className="relative aspect-square w-28 shrink-0 overflow-hidden rounded-xl bg-ink-850 sm:w-36">
          {image}
          {outOfStock && (
            <span className="absolute left-2 top-2">
              <Badge tone="red">Out of stock</Badge>
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1 py-1">
          {product.categoryName && (
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{product.categoryName}</p>
          )}
          <h3 className="line-clamp-2 text-base font-semibold text-slate-100 group-hover:text-gold-300">{product.name}</h3>
          {product.sku && <p className="text-xs text-slate-500">SKU: {product.sku}</p>}
          <div className="mt-auto pt-2">{price}</div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-ink-800 bg-ink-900/60 transition hover:border-ink-600 hover:shadow-lift"
    >
      <div className="relative aspect-square overflow-hidden bg-ink-850">
        {image}
        {outOfStock && (
          <span className="absolute left-2 top-2">
            <Badge tone="red">Out of stock</Badge>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        {product.categoryName && (
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{product.categoryName}</p>
        )}
        <h3 className="line-clamp-2 text-sm font-semibold text-slate-100 group-hover:text-gold-300">{product.name}</h3>
        <div className="mt-auto pt-2">{price}</div>
      </div>
    </Link>
  );
}
