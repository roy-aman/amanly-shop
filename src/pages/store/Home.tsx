import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Sparkles, Tag } from 'lucide-react';
import { getPublicStore } from '@/api/store';
import { listCategories, listProducts } from '@/api/catalog';
import { LinkButton, EmptyState, Skeleton } from '@/components/ui';
import { ProductGridSkeleton } from '@/components/RouteSkeletons';
import ProductCard from '@/components/ProductCard';

export default function Home() {
  const storeQuery = useQuery({ queryKey: ['public-store'], queryFn: getPublicStore });
  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: listCategories });
  const productsQuery = useQuery({
    queryKey: ['products', 'featured'],
    queryFn: () => listProducts({ size: 8 }),
  });

  const storeName = storeQuery.data?.name ?? 'Royal Commerce';
  const categories = (categoriesQuery.data ?? []).filter((c) => c.active);
  const products = productsQuery.data?.content ?? [];

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-ink-800 bg-ink-900/60 px-6 py-14 sm:px-12 sm:py-20">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-gold-400/30 to-transparent blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-tr from-gold-500/20 to-transparent blur-3xl" />
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold-400/30 bg-gold-400/10 px-3 py-1 text-xs font-medium text-gold-300">
            <Sparkles className="h-3.5 w-3.5" /> Welcome to {storeName}
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold leading-tight text-slate-50 sm:text-5xl">
            Shop the{' '}
            <span className="bg-gradient-to-r from-gold-300 to-gold-500 bg-clip-text text-transparent">finest</span>{' '}
            selection, fit for royalty
          </h1>
          <p className="mt-4 max-w-lg text-base text-slate-400">
            Curated products, effortless checkout, and service that treats every customer like a king.
          </p>
          <div className="mt-8">
            <LinkButton to="/products" size="lg">
              Shop now <ArrowRight className="h-4 w-4" />
            </LinkButton>
          </div>
        </div>
      </section>

      {/* Shop by category */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-xl font-bold text-slate-100 sm:text-2xl">Shop by category</h2>
          <Link to="/products" className="text-sm font-medium text-gold-300 hover:text-gold-200">
            Browse all
          </Link>
        </div>
        {categoriesQuery.isLoading ? (
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-32 rounded-xl" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <p className="text-sm text-slate-500">No categories yet.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {categories.map((c) => (
              <Link
                key={c.id}
                to={`/products?categoryId=${c.id}`}
                className="inline-flex items-center gap-2 rounded-xl border border-ink-800 bg-ink-900/60 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-gold-400/40 hover:text-gold-300"
              >
                <Tag className="h-4 w-4 text-gold-400" />
                {c.name}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Featured products */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-xl font-bold text-slate-100 sm:text-2xl">Featured products</h2>
          <Link to="/products" className="text-sm font-medium text-gold-300 hover:text-gold-200">
            View all
          </Link>
        </div>
        {productsQuery.isLoading ? (
          <ProductGridSkeleton />
        ) : products.length === 0 ? (
          <EmptyState
            title="No products yet"
            message="Check back soon — new arrivals are on their way."
            action={<LinkButton to="/products">Browse catalog</LinkButton>}
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
