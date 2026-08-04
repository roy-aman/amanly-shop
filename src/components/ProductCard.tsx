import { Link } from 'react-router-dom';
import { ImageOff } from 'lucide-react';
import type { ProductSummaryResponse } from '@/lib/types';
import { cn, PriceTag, RatingStars } from '@/components/ui';
import WishlistButton from '@/components/WishlistButton';

/** Layout variants: the default portrait grid tile, and a horizontal list row. */
export type ProductCardVariant = 'grid' | 'list';

/**
 * Reusable catalog card for a product summary. Links to the product detail page.
 *
 * Deliberately chrome-less: no border, no fill, no shadow. A card outline around
 * every product turns a grid into a spreadsheet; removing it lets the product
 * photography do the work and puts the whitespace back, which is the whole
 * premise of the retail brands Amanly sits beside.
 *
 * The image sits on a pale tile at 4:5. Portrait rather than square because
 * apparel and lifestyle goods are taller than they are wide, and a square crop
 * either clips the product or floats it in dead space.
 *
 * NOTE — there is no quick-add action here, on purpose. `ProductSummaryResponse`
 * carries no variant information, so the card cannot know whether a product
 * requires a size/colour choice before it can be added; a one-click add would
 * silently put the wrong SKU in the bag for every variant product. The correct
 * fix is a Quick View that fetches the full product (which does carry variants)
 * — or a `hasVariants` flag on the summary DTO — not a guess from this payload.
 */
export default function ProductCard({
  product,
  variant = 'grid',
}: {
  product: ProductSummaryResponse;
  variant?: ProductCardVariant;
}) {
  const outOfStock = product.stockQuantity <= 0;

  // Ratings arrive with WP-3.2. Fields are optional (older cached summaries lack
  // them); show stars only once at least one approved review exists — never "0 (0)".
  const hasRating = product.ratingAvg != null && (product.ratingCount ?? 0) > 0;
  const rating = hasRating ? (
    <RatingStars value={product.ratingAvg as number} count={product.ratingCount} size="sm" />
  ) : null;

  const image = product.primaryImageUrl ? (
    <img
      src={product.primaryImageUrl}
      alt={product.name}
      loading="lazy"
      className={cn(
        'h-full w-full object-cover transition duration-700 ease-emphasized group-hover:scale-[1.04]',
        // Sold-out reads as "drained", not as an alarm. A red badge on a grid of
        // products shouts the one thing the shopper can't act on.
        outOfStock && 'opacity-60 grayscale',
      )}
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center text-slate-600">
      <ImageOff className="h-8 w-8" aria-hidden />
    </div>
  );

  const wishlist = (
    <div
      className={cn(
        'absolute right-2 top-2 transition-opacity duration-200',
        // Always visible where there is no hover to reveal it; on pointer
        // devices it stays out of the way until the card is engaged.
        'opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100',
      )}
    >
      <WishlistButton productId={product.id} productName={product.name} />
    </div>
  );

  const price = (
    <PriceTag
      price={product.price}
      compareAtPrice={product.compareAtPrice}
      currency={product.currency}
      size="sm"
    />
  );

  if (variant === 'list') {
    return (
      <Link
        to={`/products/${product.slug}`}
        className="group flex gap-5 border-b border-ink-700 py-5 transition-colors last:border-b-0 hover:border-ink-600"
      >
        <div className="relative aspect-[4/5] w-24 shrink-0 overflow-hidden bg-ink-850 sm:w-32">
          {image}
          {wishlist}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-1">
          {product.categoryName && (
            <p className="text-overline uppercase text-slate-500">{product.categoryName}</p>
          )}
          <h3 className="line-clamp-2 text-body-sm font-medium text-slate-100">{product.name}</h3>
          {rating}
          {outOfStock && <p className="text-caption text-slate-500">Sold out</p>}
          <div className="mt-auto pt-2">{price}</div>
        </div>
      </Link>
    );
  }

  return (
    <Link to={`/products/${product.slug}`} className="group flex flex-col">
      <div className="relative aspect-[4/5] overflow-hidden bg-ink-850">
        {image}
        {wishlist}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 pt-3">
        {/* The category eyebrow is gone: on a category page it repeats the page
            title, and in a rail it is the least useful line in the card. */}
        <h3 className="line-clamp-2 text-body-sm font-medium text-slate-100 transition-colors group-hover:text-slate-400">
          {product.name}
        </h3>
        {rating}
        {outOfStock && <p className="text-caption text-slate-500">Sold out</p>}
        <div className="mt-auto pt-1">{price}</div>
      </div>
    </Link>
  );
}
