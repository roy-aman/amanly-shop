import { useQuery } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { getWishlist } from '@/api/wishlist';
import { useWishlist } from '@/context/WishlistContext';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import ProductCard from '@/components/ProductCard';
import { ProductGridSkeleton } from '@/components/RouteSkeletons';
import { EmptyState, LinkButton, PageHeader } from '@/components/ui';

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
      <div className="space-y-6">
        <PageHeader title="Wishlist" subtitle="Products you've saved for later." />
        <ProductGridSkeleton count={8} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wishlist"
        subtitle={
          items.length > 0
            ? `${items.length} saved item${items.length === 1 ? '' : 's'}`
            : "Products you've saved for later."
        }
      />

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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} variant="grid" />
          ))}
        </div>
      )}
    </div>
  );
}
