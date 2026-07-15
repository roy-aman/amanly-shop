import { useState, type MouseEvent } from 'react';
import { Heart } from 'lucide-react';
import { cn } from '@/components/ui';
import { useWishlist } from '@/context/WishlistContext';

interface WishlistButtonProps {
  productId: string;
  /** Product name — folded into the button's accessible label. */
  productName?: string;
  /**
   * `overlay` — a round translucent chip that floats over a card image.
   * `inline` — a bordered pill sized to sit in a buy-box action row (PDP).
   */
  variant?: 'overlay' | 'inline';
  /** Show a "Wishlist"/"Wishlisted" text label (inline variant on the PDP). */
  withLabel?: boolean;
  className?: string;
}

/**
 * Heart toggle backed by WishlistContext. Optimistic + auth-gated + rollback are
 * all handled by the context's `toggle`, so this button only owns its own busy
 * state and its accessible labelling. It depends on no other provider, which lets
 * `ProductCard` embed it anywhere (grid/list, PLP, rails) without prop threading.
 */
export default function WishlistButton({
  productId,
  productName,
  variant = 'overlay',
  withLabel = false,
  className,
}: WishlistButtonProps) {
  const { isWishlisted, toggle } = useWishlist();
  const [busy, setBusy] = useState(false);

  const active = isWishlisted(productId);
  const name = productName ?? 'product';
  const label = active ? `Remove ${name} from wishlist` : `Add ${name} to wishlist`;

  async function handleClick(e: MouseEvent) {
    // The button frequently lives inside a Link/card — never navigate to the PDP.
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      await toggle(productId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/70 disabled:opacity-50',
        variant === 'overlay'
          ? 'h-9 w-9 border border-ink-700 bg-ink-950/70 text-slate-200 backdrop-blur hover:bg-ink-900 hover:text-gold-300'
          : 'h-11 rounded-xl border border-ink-700 bg-ink-900/60 px-4 text-slate-200 hover:border-ink-500 hover:text-gold-300',
        className,
      )}
    >
      <Heart
        className={cn(
          variant === 'overlay' ? 'h-4 w-4' : 'h-5 w-5',
          'transition',
          active ? 'fill-gold-400 text-gold-400' : 'fill-none',
        )}
        aria-hidden
      />
      {withLabel && <span className="text-sm font-medium">{active ? 'Wishlisted' : 'Wishlist'}</span>}
    </button>
  );
}
