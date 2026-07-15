import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  ArrowRight,
  Flame,
  Headset,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Tag,
  Truck,
} from 'lucide-react';
import { getPublicStore } from '@/api/store';
import { getCategoryTree, listProducts } from '@/api/catalog';
import type { CategoryTreeResponse, Page, ProductSummaryResponse } from '@/lib/types';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { Badge, cn, EmptyState, LinkButton, Skeleton } from '@/components/ui';
import { ProductGridSkeleton } from '@/components/RouteSkeletons';
import ProductCard from '@/components/ProductCard';

/** How many products to pull per rail. */
const RAIL_SIZE = 12;

/**
 * Hero content is hardcoded today — there is no store-configurable hero/banner
 * backend yet. It lives in one object (not inlined into the markup) so a future
 * CMS / store-settings hook is a one-line swap: replace this constant with the
 * fetched values (e.g. a `heroHeadline` / `heroImageUrl` field on the store).
 * Do NOT invent an endpoint here — that belongs to a later work package.
 */
const HERO = {
  eyebrow: 'Curated for you',
  headlineLead: 'Shop the ',
  headlineAccent: 'finest',
  headlineTrail: ' selection, fit for royalty',
  subcopy:
    'Curated products, effortless checkout, and service that treats every customer like royalty.',
  primaryCta: { label: 'Shop the collection', to: '/products' },
  secondaryCta: { label: 'Browse categories', to: '/products' },
};

const TRUST: { icon: typeof Truck; title: string; desc: string }[] = [
  { icon: Truck, title: 'Fast, tracked delivery', desc: 'Every order ships with end-to-end tracking.' },
  { icon: ShieldCheck, title: 'Secure checkout', desc: 'Protected payments — cash on delivery & online.' },
  { icon: RotateCcw, title: 'Easy returns', desc: 'Straightforward returns on eligible items.' },
  { icon: Headset, title: 'Here to help', desc: 'Support that treats every customer like royalty.' },
];

// Brand-only decorative gradients (gold tints per design-system §1.5 — never
// semantic colours for decoration). Cycled across the category tiles.
const TILE_GRADIENTS = [
  'bg-gradient-to-br from-gold-400/15 via-transparent to-transparent',
  'bg-gradient-to-tr from-gold-500/12 via-transparent to-transparent',
  'bg-gradient-to-bl from-gold-300/12 via-transparent to-transparent',
  'bg-gradient-to-t from-gold-400/10 via-transparent to-transparent',
];

export default function Home() {
  useDocumentTitle('Home');

  // Store name + category tree come from real public endpoints. Query keys match
  // StoreLayout's so the header's already-cached results are reused (no refetch).
  const storeQuery = useQuery({
    queryKey: ['public-store'],
    queryFn: getPublicStore,
    staleTime: 5 * 60_000,
  });
  const categoryQuery = useQuery({
    queryKey: ['category-tree'],
    queryFn: getCategoryTree,
    staleTime: 5 * 60_000,
  });

  // New arrivals: real `sort=createdAt,desc` (the ProductController default sort;
  // Spring resolves the Pageable `sort` param — same contract Products.tsx uses).
  const newArrivals = useQuery({
    queryKey: ['products', 'home', 'new-arrivals'],
    queryFn: () => listProducts({ sort: 'createdAt,desc', size: RAIL_SIZE }),
  });
  // Featured: real `tag` filter (@RequestParam on the public search endpoint).
  // Empty when nothing is tagged `featured` → the rail hides itself gracefully.
  const featured = useQuery({
    queryKey: ['products', 'home', 'featured'],
    queryFn: () => listProducts({ tag: 'featured', size: RAIL_SIZE }),
  });

  const storeName = storeQuery.data?.name || 'Royal Commerce';
  const categories = categoryQuery.data ?? [];

  return (
    <div className="space-y-14 sm:space-y-16">
      <Hero storeName={storeName} />
      <CategoryTiles categories={categories} loading={categoryQuery.isLoading} />
      <ProductRailSection
        title="New arrivals"
        subtitle="Fresh additions to the collection."
        icon={<Sparkles className="h-5 w-5 text-gold-400" aria-hidden />}
        query={newArrivals}
      />
      <ProductRailSection
        title="Featured"
        subtitle="Hand-picked highlights worth a closer look."
        query={featured}
      />
      <BestSellersPlaceholder />
      <TrustRow />
      <ClosingCta storeName={storeName} />
    </div>
  );
}

// ── Hero ────────────────────────────────────────────────────────────────
function Hero({ storeName }: { storeName: string }) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-ink-800 bg-ink-900/60 px-6 py-16 shadow-glow sm:px-12 sm:py-24">
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-gold-400/25 to-transparent blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-tr from-gold-500/15 to-transparent blur-3xl"
        aria-hidden
      />
      <div className="relative max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-gold-400/30 bg-gold-400/10 px-3 py-1 text-caption font-medium text-gold-300">
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> {HERO.eyebrow} · {storeName}
        </span>
        <h1 className="mt-5 font-display text-h1 text-slate-50 sm:text-display">
          {HERO.headlineLead}
          <span className="bg-gradient-to-r from-gold-300 to-gold-500 bg-clip-text text-transparent">
            {HERO.headlineAccent}
          </span>
          {HERO.headlineTrail}
        </h1>
        <p className="mt-4 max-w-lg text-body text-slate-400">{HERO.subcopy}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <LinkButton to={HERO.primaryCta.to} size="lg">
            {HERO.primaryCta.label} <ArrowRight className="h-4 w-4" aria-hidden />
          </LinkButton>
          <LinkButton to={HERO.secondaryCta.to} size="lg" variant="secondary">
            {HERO.secondaryCta.label}
          </LinkButton>
        </div>
      </div>
    </section>
  );
}

// ── Shared section heading ──────────────────────────────────────────────
function SectionHeading({
  title,
  subtitle,
  viewAllTo,
  icon,
  badge,
}: {
  title: string;
  subtitle?: string;
  viewAllTo?: string;
  icon?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="flex items-center gap-2 font-display text-h2 text-slate-100">
          {icon}
          {title}
          {badge}
        </h2>
        {subtitle && <p className="mt-1 text-body-sm text-slate-400">{subtitle}</p>}
      </div>
      {viewAllTo && (
        <Link
          to={viewAllTo}
          className="shrink-0 rounded-lg text-body-sm font-medium text-gold-300 transition hover:text-gold-200"
        >
          View all →
        </Link>
      )}
    </div>
  );
}

// ── Category tiles ──────────────────────────────────────────────────────
function CategoryTiles({
  categories,
  loading,
}: {
  categories: CategoryTreeResponse[];
  loading: boolean;
}) {
  return (
    <section>
      <SectionHeading
        title="Shop by category"
        subtitle="Find exactly what you're looking for."
        viewAllTo="/products"
      />
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/3] w-full rounded-2xl" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <EmptyState
          icon={<Tag className="h-8 w-8" />}
          title="Categories coming soon"
          message="Our catalog is still being organized — browse everything in the meantime."
          action={<LinkButton to="/products">Browse all products</LinkButton>}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {categories.slice(0, 8).map((c, i) => (
            <Link
              key={c.id}
              to={`/products?categoryId=${c.id}`}
              className="group relative flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-2xl border border-ink-800 bg-ink-900/60 p-4 transition hover:border-gold-400/40 hover:shadow-lift"
            >
              <div
                className={cn(
                  'pointer-events-none absolute inset-0 opacity-70 transition group-hover:opacity-100',
                  TILE_GRADIENTS[i % TILE_GRADIENTS.length],
                )}
                aria-hidden
              />
              <span className="relative text-h4 text-slate-100 transition group-hover:text-gold-200">
                {c.name}
              </span>
              <span className="relative mt-0.5 inline-flex items-center gap-1 text-caption text-slate-400">
                Shop now <ArrowRight className="h-3 w-3" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Product rail ────────────────────────────────────────────────────────
/** Horizontal, snap-scrolling rail of product cards (multiple visible at once,
 *  unlike the one-per-view `Carousel`). Fixed-width items keep it CLS-safe. */
function ProductRail({ products }: { products: ProductSummaryResponse[] }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <ul className="flex snap-x snap-mandatory gap-4">
        {products.map((p) => (
          <li key={p.id} className="w-40 shrink-0 snap-start sm:w-52 lg:w-56">
            <ProductCard product={p} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProductRailSection({
  title,
  subtitle,
  icon,
  query,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  query: UseQueryResult<Page<ProductSummaryResponse>>;
}) {
  const products = query.data?.content ?? [];
  // Hide the rail entirely when there is nothing to show (sparse data or a failed
  // request) — keeps the homepage graceful rather than rendering an empty box.
  if (!query.isLoading && products.length === 0) return null;
  return (
    <section>
      <SectionHeading title={title} subtitle={subtitle} viewAllTo="/products" icon={icon} />
      {query.isLoading ? <ProductGridSkeleton count={4} /> : <ProductRail products={products} />}
    </section>
  );
}

// ── Best sellers (BLOCKED on WP-3.1) ────────────────────────────────────
/**
 * Best Sellers is BLOCKED on WP-3.1 (admin stats / popularity). No popularity or
 * top-products endpoint exists, so we do NOT fabricate one — this is a graceful
 * "coming soon" placeholder band. When WP-3.1 ships a public popularity signal
 * (`sort=popular` or a top-products endpoint), replace this with a real
 * `ProductRailSection` backed by that query.
 */
function BestSellersPlaceholder() {
  return (
    <section>
      <SectionHeading
        title="Best sellers"
        subtitle="The most-loved picks, ranked by real sales."
        icon={<Flame className="h-5 w-5 text-gold-400" aria-hidden />}
        badge={<Badge tone="gold">Coming soon</Badge>}
      />
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-ink-700 bg-ink-900/40 px-6 py-12 text-center">
        <Flame className="h-8 w-8 text-slate-600" aria-hidden />
        <p className="max-w-md text-body-sm text-slate-400">
          Best-seller rankings unlock once orders start rolling in. In the meantime, explore what&apos;s
          new and featured above.
        </p>
        <LinkButton to="/products" variant="secondary">
          Explore the catalog
        </LinkButton>
      </div>
    </section>
  );
}

// ── Trust / why-shop-with-us ────────────────────────────────────────────
function TrustRow() {
  return (
    <section className="rounded-3xl border border-ink-800 bg-ink-900/40 px-6 py-10 sm:px-10">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {TRUST.map((t) => (
          <div key={t.title} className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold-400/20 bg-gold-400/10 text-gold-300">
              <t.icon className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h3 className="text-h4 text-slate-100">{t.title}</h3>
              <p className="mt-0.5 text-body-sm text-slate-400">{t.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Closing CTA ─────────────────────────────────────────────────────────
/**
 * Closing promo band — intentionally NOT a newsletter form. StoreLayout's footer
 * already owns newsletter capture (stubbed until WP-6.4); duplicating it here
 * would be redundant. This is a pure navigational CTA (nothing to submit/stub).
 */
function ClosingCta({ storeName }: { storeName: string }) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-gold-400/20 bg-gradient-to-br from-gold-400/10 via-ink-900/60 to-ink-900/60 px-6 py-14 text-center shadow-glow sm:px-12">
      <h2 className="font-display text-h2 text-slate-50 sm:text-h1">Ready to shop {storeName}?</h2>
      <p className="mx-auto mt-3 max-w-md text-body text-slate-300">
        Discover curated products and check out in seconds.
      </p>
      <div className="mt-7 flex justify-center">
        <LinkButton to="/products" size="lg">
          Start shopping <ArrowRight className="h-4 w-4" aria-hidden />
        </LinkButton>
      </div>
    </section>
  );
}
