import { useQuery } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { getWishlist } from '@/api/wishlist';
import { useWishlist } from '@/context/WishlistContext';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import ProductCard from '@/components/ProductCard';
import { ProductGridSkeleton } from '@/components/RouteSkeletons';
import { EmptyState, LinkButton } from '@/components/ui';

/**
 * The signed-in user's saved products (route-guarded by RequireAuth). The list
 * comes from `getWishlist()`; local wishlist state (from WishlistContext) then
 * filters out any card the user un-hearts, so removing updates the list instantly
 * without a refetch — and a failed toggle (which rolls back the id) restores it.
 */
export default function Wishlist() {
  useDocumentTitle('Wishlist');
  const { isWishlisted, ready } = useWishlist();
  const query = useQuery({ queryKey: ['wishlist'], queryFn: getWishlist });

  const items = (query.data ?? []).filter((p) => !ready || isWishlisted(p.id));

  if (query.isLoading) {
    return (
      <div>
        <Header count={null} />
        <div className="mt-8">
          <ProductGridSkeleton count={8} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header count={items.length} />

      <div className="mt-8">
        {query.isError ? (
        <EmptyState
          icon={<Heart className="h-10 w-10" />}
          title="Could not load your wishlist"
          message={query.error instanceof Error ? query.error.message : 'Please try again shortly.'}
          action={<LinkButton to="/products">Browse products</LinkButton>}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Heart className="h-10 w-10" />}
          title="Your wishlist is empty"
          message="Tap the heart on any product to save it here for later."
          action={<LinkButton to="/products">Browse products</LinkButton>}
        />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 xl:grid-cols-4">
            {items.map((p) => (
              <ProductCard key={p.id} product={p} variant="grid" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Page head. Count is null while loading, so the subtitle never flashes "0 saved". */
function Header({ count }: { count: number | null }) {
  return (
    <header className="border-b border-ink-700 pb-6">
      <h1 className="font-display text-h1 text-slate-100">Wishlist</h1>
      <p className="mt-2 text-body-sm text-slate-400">
        {count === null
          ? "Pieces you've saved for later."
          : count > 0
            ? `${count} saved ${count === 1 ? 'piece' : 'pieces'}`
            : "Pieces you've saved for later."}
      </p>
    </header>
  );
}
