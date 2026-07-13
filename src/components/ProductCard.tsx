import { Link } from 'react-router-dom';
import { ImageOff } from 'lucide-react';
import type { ProductSummaryResponse } from '@/lib/types';
import { money } from '@/lib/format';
import { Badge } from '@/components/ui';

/** Reusable catalog card for a product summary. Links to the product detail page. */
export default function ProductCard({ product }: { product: ProductSummaryResponse }) {
  const outOfStock = product.stockQuantity <= 0;
  const hasCompare = product.compareAtPrice != null && product.compareAtPrice > product.price;

  return (
    <Link
      to={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-ink-800 bg-ink-900/60 transition hover:border-ink-600 hover:shadow-lift"
    >
      <div className="relative aspect-square overflow-hidden bg-ink-850">
        {product.primaryImageUrl ? (
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
        )}
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
        <div className="mt-auto flex items-baseline gap-2 pt-2">
          <span className="text-base font-bold text-gold-300">{money(product.price, product.currency)}</span>
          {hasCompare && (
            <span className="text-xs text-slate-500 line-through">{money(product.compareAtPrice, product.currency)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
