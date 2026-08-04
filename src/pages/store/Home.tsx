import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { ArrowRight, Headset, RotateCcw, ShieldCheck, Truck } from 'lucide-react';
import { getPublicStore } from '@/api/store';
import { getCategoryTree, getTopProducts, listProducts } from '@/api/catalog';
import type { CategoryTreeResponse, Page, ProductSummaryResponse } from '@/lib/types';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { useInView } from '@/lib/useInView';
import { BRAND_DESCRIPTION, BRAND_NAME } from '@/lib/brand';
import { cn, EmptyState, LinkButton, Skeleton } from '@/components/ui';
import { ProductGridSkeleton } from '@/components/RouteSkeletons';
import ProductCard from '@/components/ProductCard';

/** How many products to pull per rail. */
const RAIL_SIZE = 12;

/**
 * Hero copy. Typography-led on purpose: the repository ships no brand imagery
 * and the backend has no hero-image field, so a layout that depends on a photo
 * would render as a broken promise. This composition is complete as type — and
 * when art direction exists, drop an <img> into the slot marked below rather
 * than inventing an endpoint here.
 */
const HERO = {
  eyebrow: BRAND_DESCRIPTION,
  headline: ['Fewer things.', 'Better made.'],
  subcopy:
    'A tight edit of everyday pieces — chosen for fit, fabric, and how they wear over time.',
  primaryCta: { label: 'Shop the collection', to: '/products' },
  secondaryCta: { label: 'New in', to: '/products?sort=createdAt,desc' },
};

/**
 * The brand argument, in the middle of the page where a shopper decides whether
 * this is a real label or a reseller. This replaced a row of delivery icons —
 * shipping promises are service terms, and they now sit in a slim strip above
 * the footer where service terms belong.
 */
const STORY: { title: string; body: string }[] = [
  {
    title: 'Curated, not catalogued',
    body: 'We carry a short list. Every piece has to earn its place against what we already stock.',
  },
  {
    title: 'Made to last',
    body: 'Fabric and construction chosen for how they hold up after fifty wears, not five.',
  },
  {
    title: 'Straight answers',
    body: 'Honest stock counts, realistic delivery dates, and a person who replies.',
  },
];

const TRUST: { icon: typeof Truck; title: string; desc: string }[] = [
  { icon: Truck, title: 'Fast, tracked delivery', desc: 'Every order ships with end-to-end tracking.' },
  { icon: ShieldCheck, title: 'Secure checkout', desc: 'Protected payments — online or cash on delivery.' },
  { icon: RotateCcw, title: 'Easy returns', desc: 'Straightforward returns on eligible items.' },
  { icon: Headset, title: 'Here to help', desc: 'Questions answered by someone who knows the stock.' },
];

export default function Home() {
  useDocumentTitle('');

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
  // Best sellers: real public top-products endpoint (WP-3.1a), ranked by units
  // sold across paid orders. Returns [] until something sells → rail hides itself.
  const bestSellers = useQuery({
    queryKey: ['products', 'home', 'best-sellers'],
    queryFn: () => getTopProducts({ limit: RAIL_SIZE }),
  });

  const storeName = storeQuery.data?.name || BRAND_NAME;
  const categories = categoryQuery.data ?? [];

  return (
    <div>
      <Hero />

      <div className="space-y-24 sm:space-y-32">
        <Reveal>
          <CategoryTiles categories={categories} loading={categoryQuery.isLoading} />
        </Reveal>

        <Reveal>
          <ProductRailSection
            title="New in"
            subtitle="The latest additions to the edit."
            viewAllTo="/products?sort=createdAt,desc"
            query={newArrivals}
          />
        </Reveal>

        <Reveal>
          <StoryBand />
        </Reveal>

        <Reveal>
          <BestSellersRail query={bestSellers} />
        </Reveal>

        <Reveal>
          <ProductRailSection
            title="Featured"
            subtitle="Hand-picked highlights worth a closer look."
            viewAllTo="/products"
            query={featured}
          />
        </Reveal>

        <Reveal>
          <TrustStrip />
        </Reveal>

        <Reveal>
          <ClosingBand storeName={storeName} />
        </Reveal>
      </div>
    </div>
  );
}

/** Fades a section up the first time it reaches the viewport. */
function Reveal({ children }: { children: ReactNode }) {
  const [ref, state] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className="rc-reveal" data-reveal={state}>
      {children}
    </div>
  );
}

// ── Hero ────────────────────────────────────────────────────────────────
/**
 * Full-bleed, centred, and mostly empty. The old hero was a bordered, glowing
 * `rounded-3xl` panel — which reads as a dashboard card, not a brand statement.
 * A storefront's first screen has one job: say who this is.
 */
function Hero() {
  return (
    <section className="rc-bleed -mt-8 border-b border-ink-700 bg-ink-850">
      {/* Art-direction slot: an <img> placed here behind the copy (with a scrim
          over it) is the only change needed to make this a photographic hero. */}
      <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center sm:py-32 lg:py-40">
        <p className="text-overline uppercase text-slate-500">{HERO.eyebrow}</p>

        <h1 className="mt-6 font-display text-display text-slate-100">
          {HERO.headline.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h1>

        <p className="mt-7 max-w-md text-body text-slate-400">{HERO.subcopy}</p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <LinkButton to={HERO.primaryCta.to} size="xl">
            {HERO.primaryCta.label}
          </LinkButton>
          <Link
            to={HERO.secondaryCta.to}
            className="text-body-sm font-medium text-slate-100 underline decoration-brand decoration-2 underline-offset-[6px] transition-colors hover:text-slate-400"
          >
            {HERO.secondaryCta.label}
          </Link>
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
}: {
  title: string;
  subtitle?: string;
  viewAllTo?: string;
}) {
  return (
    <div className="mb-8 flex items-end justify-between gap-6 border-b border-ink-700 pb-5">
      <div>
        <h2 className="font-display text-h2 text-slate-100">{title}</h2>
        {subtitle && <p className="mt-2 text-body-sm text-slate-400">{subtitle}</p>}
      </div>
      {viewAllTo && (
        <Link
          to={viewAllTo}
          className="shrink-0 text-overline uppercase text-slate-500 transition-colors hover:text-slate-100"
        >
          View all
        </Link>
      )}
    </div>
  );
}

// ── Collections ─────────────────────────────────────────────────────────
/**
 * Category tiles are typographic. `CategoryTreeResponse` carries no image, so
 * rather than fake one with a gradient wash (the previous approach), the tile
 * commits to being a label — large type on a pale ground, which is how the
 * reference brands present collection entry points anyway.
 */
function CategoryTiles({ categories, loading }: { categories: CategoryTreeResponse[]; loading: boolean }) {
  return (
    <section>
      <SectionHeading title="Collections" subtitle="Browse the edit by category." viewAllTo="/products" />
      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5] w-full rounded-none" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <EmptyState
          title="Categories coming soon"
          message="The catalog is still being organised — browse everything in the meantime."
          action={<LinkButton to="/products">Browse all products</LinkButton>}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {categories.slice(0, 6).map((c) => (
            <Link
              key={c.id}
              to={`/products?categoryId=${c.id}`}
              className="group relative flex aspect-[4/5] flex-col justify-end overflow-hidden bg-ink-850 p-6 transition-colors hover:bg-ink-800"
            >
              <h3 className="font-display text-h2 text-slate-100">{c.name}</h3>
              <span className="mt-2 inline-flex items-center gap-2 text-overline uppercase text-slate-500 transition-transform duration-300 group-hover:translate-x-1">
                Shop <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Product rail ────────────────────────────────────────────────────────
/** Horizontal, snap-scrolling rail of product cards. Fixed-width items keep it
 *  CLS-safe, and a partially-visible next card signals that it scrolls. */
function ProductRail({ products }: { products: ProductSummaryResponse[] }) {
  return (
    <div className="rc-bleed overflow-x-auto px-4 pb-2 sm:px-6 lg:px-8">
      <ul className="mx-auto flex max-w-7xl snap-x snap-mandatory gap-4 sm:gap-6">
        {products.map((p) => (
          <li key={p.id} className="w-44 shrink-0 snap-start sm:w-56 lg:w-64">
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
  viewAllTo,
  query,
}: {
  title: string;
  subtitle?: string;
  viewAllTo?: string;
  query: UseQueryResult<Page<ProductSummaryResponse>>;
}) {
  const products = query.data?.content ?? [];
  // Hide the rail entirely when there is nothing to show (sparse data or a failed
  // request) — keeps the homepage graceful rather than rendering an empty box.
  if (!query.isLoading && products.length === 0) return null;
  return (
    <section>
      <SectionHeading title={title} subtitle={subtitle} viewAllTo={viewAllTo} />
      {query.isLoading ? <ProductGridSkeleton count={4} /> : <ProductRail products={products} />}
    </section>
  );
}

// ── Best sellers (WP-3.1) ───────────────────────────────────────────────
/**
 * Best sellers, ranked by real sales via the public `/products/top` endpoint
 * (WP-3.1a). The endpoint returns `[]` until something has sold, so the rail
 * hides itself gracefully — no "coming soon" placeholder needed. NOTE: this
 * endpoint does NOT compose with the PLP's filters/pagination, so it powers only
 * this standalone rail.
 */
function BestSellersRail({ query }: { query: UseQueryResult<ProductSummaryResponse[]> }) {
  const products = query.data ?? [];
  if (!query.isLoading && products.length === 0) return null;
  return (
    <section>
      <SectionHeading
        title="Best sellers"
        subtitle="The most-bought pieces, ranked by real sales."
        viewAllTo="/products"
      />
      {query.isLoading ? <ProductGridSkeleton count={4} /> : <ProductRail products={products} />}
    </section>
  );
}

// ── Brand story ─────────────────────────────────────────────────────────
function StoryBand() {
  return (
    <section className="rc-bleed bg-ink-850 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="max-w-2xl font-display text-h1 text-slate-100">
          A short list, chosen properly.
        </h2>
        <div className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-8">
          {STORY.map((s, i) => (
            <div key={s.title} className="border-t border-ink-600 pt-5">
              <span className="text-overline uppercase text-slate-500">0{i + 1}</span>
              <h3 className="mt-3 text-h4 text-slate-100">{s.title}</h3>
              <p className="mt-2.5 text-body-sm text-slate-400">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Service terms ───────────────────────────────────────────────────────
/** Deliberately quiet and near the footer: these are terms, not selling points,
 *  and a shopper looks for them at the end of the page, not the middle. */
function TrustStrip() {
  return (
    <section className="border-y border-ink-700 py-10">
      <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
        {TRUST.map((t) => (
          <div key={t.title}>
            <t.icon className="h-5 w-5 text-slate-400" aria-hidden />
            <h3 className="mt-3 text-body-sm font-medium text-slate-100">{t.title}</h3>
            <p className="mt-1 text-caption text-slate-500">{t.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Closing band ────────────────────────────────────────────────────────
/**
 * Closes the page on the brand rather than on a form — the footer immediately
 * below already owns newsletter capture, and asking twice reads as pestering.
 */
function ClosingBand({ storeName }: { storeName: string }) {
  return (
    <section className={cn('rc-bleed bg-primary px-6 py-24 text-center sm:py-28')}>
      <h2 className="mx-auto max-w-2xl font-display text-h1 text-primary-fg">
        Everything {storeName} makes, in one place.
      </h2>
      <div className="mt-10 flex justify-center">
        <Link
          to="/products"
          className="inline-flex h-14 items-center justify-center bg-ink-950 px-8 text-sm font-semibold uppercase tracking-[0.12em] text-slate-100 transition hover:bg-ink-850"
        >
          Shop all
        </Link>
      </div>
    </section>
  );
}
