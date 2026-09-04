import { useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, ShoppingBag, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/components/ui';
import { useCart } from '@/context/CartContext';
import type { ProductSummaryResponse } from '@/lib/types';

/**
 * The buy control that lives on a catalogue card: "Add to bag" until the product is in the bag,
 * then a −/+ stepper on the line itself.
 *
 * <p><b>Why on the card at all.</b> Every add previously cost a round trip to the product page and
 * back, which is the wrong price for a second cap or a repeat order — the shopper already knows
 * what they want. Uniqlo, Zara and every grocery app put the control on the tile for exactly this
 * reason, and swap it for a stepper once the item is in, so the tile also answers "how many did I
 * take?" without opening the bag.
 *
 * <p><b>Variants are the trap.</b> {@link ProductSummaryResponse} carries no variant list, so a card
 * cannot know which SKU a one-click add would take — for a sized product it would silently put the
 * wrong one in the bag. It now carries {@code hasVariants}, and this control sends those products to
 * their page to be chosen rather than guessing. That flag is the whole reason a quick-add is safe
 * here; without it the honest answer was the one this file used to give, which was not to have one.
 *
 * <p>All state lives in CartContext, so this depends on no other provider and can be dropped into
 * any card, rail or grid without prop threading — the arrangement WishlistButton already uses.
 */
export default function AddToBagButton({
  product,
  className,
}: {
  product: ProductSummaryResponse;
  className?: string;
}) {
  const { lineFor, addProduct, setProductQuantity } = useCart();
  const [busy, setBusy] = useState(false);

  const line = lineFor(product.id);
  const soldOut = product.stockQuantity <= 0;
  const needsChoosing = product.hasVariants === true;

  /**
   * These controls sit inside a card whose whole surface links to the product. Every handler has to
   * stop the click reaching it, or adding to the bag would also navigate away from the grid.
   */
  function swallow(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  async function run(event: MouseEvent, action: () => Promise<unknown>) {
    swallow(event);
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  /**
   * One geometry for every state. The add button and the stepper are the same pill — same height,
   * radius, width and border — so the control does not jump the card's layout when it changes, and
   * the change reads as the button *becoming* the counter rather than being replaced by it. That
   * swap is the whole trick in the grocery apps this is modelled on.
   */
  const shell =
    'inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border text-body-sm ' +
    'font-medium transition duration-200 ease-emphasized focus-visible:outline-none ' +
    'focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed';

  if (soldOut) {
    return (
      <button
        type="button"
        disabled
        onClick={swallow}
        className={cn(shell, 'border-ink-700 text-slate-500 opacity-70', className)}
      >
        Sold out
      </button>
    );
  }

  // A sized product cannot be added blind, so the card offers the honest next step instead of a
  // button that would fail with VARIANT_REQUIRED after the shopper had already committed to it.
  if (needsChoosing) {
    return (
      <Link
        to={`/products/${product.slug}`}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          shell,
          'border-ink-600 px-4 text-slate-200 hover:border-slate-100 hover:text-slate-100',
          className,
        )}
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden />
        Choose options
      </Link>
    );
  }

  if (!line) {
    return (
      <button
        type="button"
        onClick={(e) => void run(e, () => addProduct(product.id, 1, product.name))}
        disabled={busy}
        aria-label={`Add ${product.name} to bag`}
        className={cn(
          shell,
          // Outlined in the brand gold rather than a solid slab. A filled white pill on every tile
          // was the loudest thing in the grid — louder than the products — and a row of them read
          // as a toolbar. An outline sits back until it is wanted, then fills on hover.
          'border-gold-400/45 px-4 text-brand-ink hover:border-gold-400 hover:bg-gold-400/10',
          'active:scale-[0.97] disabled:opacity-50',
          className,
        )}
      >
        <ShoppingBag className={cn('h-4 w-4 transition-transform duration-200', busy && 'animate-pulse')} aria-hidden />
        Add to bag
      </button>
    );
  }

  const atStockCeiling = line.quantity >= product.stockQuantity;
  const step =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-brand-ink transition ' +
    'duration-200 ease-emphasized hover:bg-gold-400/15 active:scale-90 ' +
    'disabled:cursor-not-allowed disabled:opacity-35 disabled:active:scale-100 disabled:hover:bg-transparent';

  return (
    <div
      className={cn(
        shell,
        'justify-between border-gold-400/45 bg-gold-400/5 px-0.5',
        busy && 'opacity-70',
        className,
      )}
    >
      {/* At one, decreasing removes the line — the same gesture grocery apps use, and the only way
          out of the bag from a grid without a separate delete control. */}
      <button
        type="button"
        onClick={(e) =>
          void run(e, () => setProductQuantity(product.id, line.quantity - 1, product.name))
        }
        disabled={busy}
        aria-label={
          line.quantity === 1
            ? `Remove ${product.name} from bag`
            : `Decrease ${product.name} quantity`
        }
        className={step}
      >
        <Minus className="h-4 w-4" aria-hidden />
      </button>

      {/* Just the number, the way a bag counter reads everywhere else. "2 in bag" with a tick was
          three pieces of furniture for one fact, and at card width it crowded the two controls that
          actually do something. Remounted on change so the new figure lands with a beat. */}
      <span className="px-1 text-body-sm font-semibold tabular-nums text-brand-ink">
        <span key={line.quantity} className="inline-block animate-pop">
          {line.quantity}
        </span>
        <span className="sr-only" aria-live="polite">
          {line.quantity} in bag
        </span>
      </span>

      <button
        type="button"
        onClick={(e) =>
          void run(e, () => setProductQuantity(product.id, line.quantity + 1, product.name))
        }
        disabled={busy || atStockCeiling}
        aria-label={`Increase ${product.name} quantity`}
        title={atStockCeiling ? 'No more in stock' : undefined}
        className={step}
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
