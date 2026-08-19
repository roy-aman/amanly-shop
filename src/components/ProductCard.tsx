import { Link } from 'react-router-dom';
import { ImageOff } from 'lucide-react';
import type { ProductSummaryResponse } from '@/lib/types';
import { cn, PriceTag, RatingStars, revealOnLoad } from '@/components/ui';
import WishlistButton from '@/components/WishlistButton';
import AddToBagButton from '@/components/AddToBagButton';

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
 * The card carries a quick-add (see `AddToBagButton`). This was deliberately absent
 * until `ProductSummaryResponse` gained `hasVariants`: without it the card could not
 * tell whether a product needed a size/colour chosen first, and a one-click add would
 * have put the wrong SKU in the bag for every variant product. With the flag, variant
 * products are sent to their page to be chosen and only variantless ones add in place.
 *
 * The whole card is the click target, via a stretched link on the title rather than an
 * anchor wrapped around everything: the buy controls are real buttons, and interactive
 * elements cannot legally nest inside an `<a>` — nor should a click meant for `+` also
 * navigate away from the grid.
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
      // `rc-img` holds the image at opacity 0 until it has decoded, then fades
      // and settles it. Without this a grid of tiles pops in band by band as
      // each request lands, which is the least composed a page ever looks.
      {...revealOnLoad}
      className={cn(
        'rc-img h-full w-full object-cover',
        // The zoom is slow and small on purpose: it should register as the tile
        // responding, not as an effect.
        'duration-[900ms] ease-emphasized group-hover:scale-[1.06]',
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
        // z-20: the title's stretched link paints over the whole card, and it comes
        // later in the DOM, so anything meant to stay clickable has to out-rank it.
        'absolute right-2 top-2 z-20 transition-opacity duration-200',
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

  /**
   * The image tile. Sold-out is treated here rather than on the <img> itself:
   * a Tailwind `opacity` utility on the image would outrank `.rc-img`'s
   * `opacity: 0` (utilities cascade after components) and the tile would skip
   * its fade-in entirely.
   *
   * Sold-out reads as "drained", not as an alarm — a red badge on a grid of
   * products shouts the one thing the shopper cannot act on.
   */
  const tile = (className: string) => (
    <div className={cn('relative overflow-hidden rounded-xl bg-ink-850', className)}>
      <div className={cn('h-full w-full', outOfStock && 'opacity-60 grayscale')}>{image}</div>
      {/* A whisper of ink at the bottom on hover, so the tile acknowledges the
          pointer even where the photography is pale edge-to-edge. */}
      <div
        // Neutral black, not `slate-900` (#0f172a): that step is a static blue
        // -black that never flips with the palette, and a cool cast under a
        // warm gold is the exact thing the brand notes warn against.
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/15 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        aria-hidden
      />
      {outOfStock && (
        <span className="absolute bottom-2 left-2 rounded-full bg-ink-950/90 px-2.5 py-1 text-caption text-slate-300 backdrop-blur-sm">
          Sold out
        </span>
      )}
      {wishlist}
    </div>
  );

  /**
   * The title link, stretched over the whole card by a pseudo-element. This is the Bootstrap
   * `stretched-link` idea and it is what lets the card be one big target while the buy controls
   * stay real buttons: a screen reader still hears one link named after the product, and a mouse
   * anywhere on the card hits it — except where a control deliberately sits on top.
   */
  const titleLink = (
    <Link
      to={`/products/${product.slug}`}
      className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/70"
    >
      {product.name}
    </Link>
  );

  const buy = (
    <div className="relative z-10 pt-3">
      <AddToBagButton product={product} />
    </div>
  );

  if (variant === 'list') {
    return (
      <div className="group relative flex gap-5 rounded-2xl border-b border-ink-700 px-2 py-5 transition-colors duration-300 last:border-b-0 hover:bg-ink-850/60">
        {tile('aspect-[4/5] w-24 shrink-0 sm:w-32')}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-1">
          {product.categoryName && (
            <p className="text-overline uppercase text-slate-500">{product.categoryName}</p>
          )}
          <h3 className="line-clamp-2 text-body-sm font-medium text-slate-100 transition-colors duration-300 group-hover:text-slate-400">
            {titleLink}
          </h3>
          {rating}
          <div className="mt-auto pt-2">{price}</div>
          {/* Narrower than the tile it sits under, so a row of them does not read as a toolbar. */}
          <div className="relative z-10 max-w-[13rem] pt-3">
            <AddToBagButton product={product} />
          </div>
        </div>
      </div>
    );
  }

  return (
    // `h-full` is what makes a row of cards line up. Grid and flex containers stretch their items
    // to the tallest one already, but the card only inherited that height if it asked for it —
    // without this it was content-height, `mt-auto` below had nothing to push against, and a
    // two-line product name shoved that card's Add button lower than its neighbours'.
    <div className="group relative flex h-full flex-col">
      {tile('aspect-[4/5]')}

      <div className="flex flex-1 flex-col gap-1.5 pt-3.5">
        {/* The category eyebrow is gone: on a category page it repeats the page
            title, and in a rail it is the least useful line in the card. */}
        {/* A colour shift rather than the `.rc-link` underline: this title is
            `line-clamp-2` and an absolutely-positioned rule sits under only the
            first line fragment once the text wraps. The image zoom is already
            carrying the hover. */}
        {/* Two lines are reserved whether or not the name needs them (3.1em = 2 x the 1.55
            line-height of `body-sm`). It clamps at two anyway, so this costs a short name some
            whitespace and buys every card the same price position — across rows too, which
            bottom-anchoring alone cannot do since grid rows size independently. */}
        <h3 className="line-clamp-2 min-h-[3.1em] text-body-sm font-medium text-slate-100 transition-colors duration-300 group-hover:text-slate-400">
          {titleLink}
        </h3>
        {rating}
        {/* Everything from here down is bottom-anchored, so a card carrying a rating badge still
            puts its price and its button level with a card that has none. */}
        <div className="mt-auto pt-1">{price}</div>
        {buy}
      </div>
    </div>
  );
}
