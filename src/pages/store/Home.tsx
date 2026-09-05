import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { ArrowRight, Headset, RotateCcw, ShieldCheck, Truck } from 'lucide-react';
import { getPublicStore } from '@/api/store';
import { listBanners } from '@/api/banners';
import { getCategoryTree, getTopProducts, listProducts } from '@/api/catalog';
import { listServices } from '@/api/services';
import type {
  CategoryTreeResponse,
  Page,
  ProductSummaryResponse,
  PublicStoreResponse,
  ServiceOfferingResponse,
} from '@/lib/types';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { useInView } from '@/lib/useInView';
import { BRAND_DESCRIPTION, BRAND_NAME } from '@/lib/brand';
import { cn, EmptyState, LinkButton, Skeleton } from '@/components/ui';
import { ProductGridSkeleton } from '@/components/RouteSkeletons';
import ProductCard from '@/components/ProductCard';
import ServiceCard from '@/components/ServiceCard';
import { BannerSlot } from '@/components/BannerSlot';

/** How many products to pull per rail. */
const RAIL_SIZE = 12;

/**
 * Fallback hero copy, used until a merchant writes their own.
 *
 * The three lines are editable per store (`heroEyebrow` / `heroHeadline` /
 * `heroSubtext` on the public store response). The server sends null rather than
 * pre-filling these, which is what lets this default be improved later — a
 * default written into every row at migration time could never be changed again.
 *
 * Typography-led on purpose: a store with no campaign booked has no brand
 * imagery to lay this over, and a composition that depends on a photo would
 * render as a broken promise.
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

  // Services, for shops that take bookings. Gated on the store payload rather
  // than merely rendering empty: a retail-only shop must not fire this request
  // at all, since without the entitlement it answers 404 by design.
  const bookingsEnabled = storeQuery.data?.bookingsEnabled === true;
  const services = useQuery({
    queryKey: ['services', { page: 0, size: RAIL_SIZE }],
    queryFn: () => listServices({ page: 0, size: RAIL_SIZE }),
    enabled: bookingsEnabled,
  });

  // Same query key as the BannerSlot below, so this shares that cache rather than
  // fetching twice. Read here because it decides the shape of the whole page: the
  // merchant's own campaign leads when there is one, and the typographic hero
  // stands in when there is not.
  const heroBanners = useQuery({
    queryKey: ['banners', 'HOME_HERO'],
    queryFn: () => listBanners('HOME_HERO'),
    staleTime: 60_000,
    retry: false,
  });

  const storeName = storeQuery.data?.name || BRAND_NAME;
  const categories = categoryQuery.data ?? [];
  const hasHeroBanner = (heroBanners.data ?? []).length > 0;

  return (
    <div>
      {/* Both slots render nothing at all when the merchant has booked nothing,
          so the page below is byte-for-byte what it was before banners existed. */}
      <BannerSlot placement="HOME_STRIP" className="rc-bleed -mt-8" />

      {/* The first screen goes to whatever the merchant is actually selling this
          week: a booked campaign takes it outright — full bleed, sliding, each
          slide linking wherever it points. With nothing booked the brand
          statement keeps the slot, because a storefront opening on a category
          grid has no first screen at all. The displaced statement is not lost;
          it closes the page instead (see the foot of this component). */}
      {hasHeroBanner ? (
        <BannerSlot placement="HOME_HERO" variant="hero" className="rc-bleed -mt-8" />
      ) : (
        <Hero store={storeQuery.data} atTop />
      )}

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

        {/* Renders nothing at all unless this shop takes bookings AND has
            published services — a rail that could appear empty on the front page
            is worse than one that never appears. */}
        {bookingsEnabled && (
          <Reveal>
            <ServicesRailSection query={services} />
          </Reveal>
        )}

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

        {/* The page closes on the brand either way — the question is whose words.
            When a campaign has taken the first screen the merchant's own statement
            closes instead, which is the one place it can go without competing with
            the campaign or being repeated. Only one of the two ever renders: two
            closing statements in a row would each make the other weaker. */}
        <Reveal>
          {hasHeroBanner ? (
            <Hero store={storeQuery.data} />
          ) : (
            <ClosingBand storeName={storeName} />
          )}
        </Reveal>
      </div>
    </div>
  );
}

/**
 * Fades a section up the first time it reaches the viewport. `delay` staggers
 * siblings that share a viewport — without it a grid arrives as one slab, which
 * reads as a page-load rather than as a composition.
 */
function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const [ref, state] = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className="rc-reveal"
      data-reveal={state}
      style={delay ? ({ '--rc-delay': `${delay}ms` } as React.CSSProperties) : undefined}
    >
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
function Hero({ store, atTop = false }: { store?: PublicStoreResponse; atTop?: boolean }) {
  // Per store where the merchant has written it, the shipped copy otherwise. Each
  // line falls back on its own, so editing only the headline leaves the other two
  // as they were rather than blanking them.
  const eyebrow = store?.heroEyebrow?.trim() || HERO.eyebrow;
  const subcopy = store?.heroSubtext?.trim() || HERO.subcopy;
  // Newlines are the line breaks. A merchant writing one line gets one line; the
  // default is two, and the composition holds either.
  const headline = store?.heroHeadline?.trim()
    ? store.heroHeadline.split('\n').map((l) => l.trim()).filter(Boolean)
    : HERO.headline;

  return (
    <section
      className={cn(
        'rc-bleed relative overflow-hidden bg-ink-850',
        // The negative margin only makes sense against the header. Closing the
        // page, it would haul the band up over the section above it.
        atTop ? '-mt-8 border-b border-ink-700' : 'border-y border-ink-700',
      )}
    >
      {/* Art-direction slot: an <img> placed here behind the copy (with a scrim
          over it) is the only change needed to make this a photographic hero.
          Until then, two very faint gold washes give the band some depth so it
          reads as a designed surface rather than an empty grey rectangle. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(60rem 30rem at 50% -20%, rgb(var(--brand) / 0.14), transparent 70%),' +
            'radial-gradient(40rem 24rem at 90% 110%, rgb(var(--brand) / 0.08), transparent 70%)',
        }}
        aria-hidden
      />

      {/* The hero is on screen at load, so it animates on arrival rather than
          waiting for an observer. Each line follows the one above it — the
          delays are what make it feel composed instead of merely animated. */}
      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center sm:py-32 lg:py-40">
        <p className="rc-enter text-overline uppercase text-slate-500">{eyebrow}</p>

        <h1 className="mt-6 font-display text-display text-slate-100">
          {headline.map((line, i) => (
            <span
              key={line}
              className="rc-enter block"
              style={{ animationDelay: `${100 + i * 110}ms` }}
            >
              {line}
            </span>
          ))}
        </h1>

        <p className="rc-enter mt-7 max-w-md text-body text-slate-400" style={{ animationDelay: '340ms' }}>
          {subcopy}
        </p>

        <div
          className="rc-enter mt-10 flex flex-col items-center gap-5 sm:flex-row sm:gap-6"
          style={{ animationDelay: '440ms' }}
        >
          <LinkButton to={HERO.primaryCta.to} size="xl">
            {HERO.primaryCta.label}
          </LinkButton>
          <Link
            to={HERO.secondaryCta.to}
            className="group inline-flex items-center gap-2 text-body-sm font-medium text-slate-100 transition-colors hover:text-slate-400"
          >
            <span className="rc-link">{HERO.secondaryCta.label}</span>
            <ArrowRight
              className="h-4 w-4 transition-transform duration-300 ease-emphasized group-hover:translate-x-1"
              aria-hidden
            />
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
          className="group inline-flex shrink-0 items-center gap-1.5 text-overline uppercase text-slate-500 transition-colors hover:text-slate-100"
        >
          <span className="rc-link">View all</span>
          <ArrowRight
            className="h-3.5 w-3.5 transition-transform duration-300 ease-emphasized group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      )}
    </div>
  );
}

// ── Collections ─────────────────────────────────────────────────────────
/**
 * Collection tiles. `CategoryTreeResponse` carries `imageUrl`, so a merchant who has uploaded one
 * gets real photography behind the name; the scrim below keeps the type legible over it.
 *
 * <p>Until then the tile commits to being a label — large type on a pale ground with a gold wash on
 * hover — rather than faking a picture with a gradient. That is how the reference brands present
 * collection entry points anyway, so the unset state is a deliberate look, not a placeholder.
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
          {categories.slice(0, 6).map((c, i) => (
            <Reveal key={c.id} delay={i * 70}>
              <Link
                to={`/products?categoryId=${c.id}`}
                className="rc-lift group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-2xl bg-ink-850 p-6 transition-colors duration-500 hover:bg-ink-800 focus:outline-none focus-visible:outline-none"
              >
                {/* Real photography when the merchant has set it. Empty alt:
                    the category name is right below as actual text, so
                    describing the picture would say it twice. */}
                {c.imageUrl && (
                  <img
                    src={c.imageUrl}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                )}
                {/* Over a photograph this is a scrim that keeps the name
                    legible; on a bare tile it is the gold wash that gives the
                    hover something to reveal. */}
                <span
                  className={cn(
                    'pointer-events-none absolute inset-0 transition-opacity duration-500',
                    c.imageUrl
                      ? 'bg-gradient-to-t from-ink-950/85 via-ink-950/30 to-transparent opacity-100'
                      : 'bg-gradient-to-t from-brand/20 via-transparent to-transparent opacity-0 group-hover:opacity-100',
                  )}
                  aria-hidden
                />
                <h3 className="relative font-display text-h2 text-slate-100">{c.name}</h3>
                <span className="relative mt-2 inline-flex items-center gap-2 text-overline uppercase text-slate-500 transition-transform duration-300 ease-emphasized group-hover:translate-x-1">
                  Shop <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </span>
              </Link>
            </Reveal>
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
    // `rc-rail` hides the scrollbar only — the rail still scrolls by wheel,
    // drag, and keyboard, and the tab order is untouched.
    <div className="rc-bleed rc-rail overflow-x-auto px-4 pb-2 sm:px-6 lg:px-8">
      <ul className="mx-auto flex max-w-7xl snap-x snap-mandatory gap-4 sm:gap-6">
        {products.map((p, i) => (
          <li
            key={p.id}
            className="rc-enter w-44 shrink-0 snap-start sm:w-56 lg:w-64"
            // Capped so a twelve-item rail doesn't leave the last card waiting
            // most of a second before it appears.
            style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}
          >
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

/**
 * Services on the front page.
 *
 * Same rail furniture as the product sections so the page keeps one rhythm, and
 * the same rule about hiding itself: nothing to show, nothing rendered. The
 * subtitle carries the one fact that makes people click — that they can choose a
 * time themselves rather than ringing up.
 */
function ServicesRailSection({ query }: { query: UseQueryResult<Page<ServiceOfferingResponse>> }) {
  const services = query.data?.content ?? [];
  if (!query.isLoading && services.length === 0) return null;
  return (
    <section>
      <SectionHeading
        title="Book an appointment"
        subtitle="Pick a service and a time that suits you. Pay when you come in."
        viewAllTo="/services"
      />
      {query.isLoading ? (
        <ProductGridSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {services.slice(0, 4).map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      )}
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
            <Reveal key={s.title} delay={i * 110}>
              {/* The top rule draws itself in gold across the column on hover —
                  the one moving part in an otherwise still band. */}
              <div className="group relative border-t border-ink-600 pt-5">
                <span
                  className="absolute -top-px left-0 h-px w-0 bg-brand transition-[width] duration-700 ease-emphasized group-hover:w-full"
                  aria-hidden
                />
                <span className="text-overline uppercase text-slate-500">0{i + 1}</span>
                <h3 className="mt-3 text-h4 text-slate-100">{s.title}</h3>
                <p className="mt-2.5 text-body-sm text-slate-400">{s.body}</p>
              </div>
            </Reveal>
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
          <div key={t.title} className="group">
            <t.icon
              className="h-5 w-5 text-slate-400 transition-colors duration-300 group-hover:text-brand-ink"
              aria-hidden
            />
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
    // `band`, not `primary`: this is ~24rem of solid fill across the full
    // viewport. Inverting it on the dark palette would put a near-white slab in
    // the middle of the page — the single most tiring thing a dark theme can
    // do. On light it is the same black it always was. See index.css.
    <section className={cn('rc-bleed relative overflow-hidden bg-band px-6 py-24 text-center sm:py-28')}>
      {/* A single hairline of brand gold across the top of the band — the mark
          the brand sheet leads with, at architectural scale. */}
      <span className="absolute inset-x-0 top-0 h-px bg-brand/60" aria-hidden />
      <h2 className="mx-auto max-w-2xl font-display text-h1 text-band-fg">
        Everything {storeName} makes, in one place.
      </h2>
      <div className="mt-10 flex justify-center">
        {/* Inverted against the band it sits on, so the CTA reads in both
            palettes without a second set of tokens. */}
        <Link
          to="/products"
          className="group inline-flex h-14 items-center justify-center gap-2.5 rounded-full bg-band-fg px-9 text-sm font-semibold uppercase tracking-[0.12em] text-band shadow-sm transition duration-200 ease-emphasized hover:shadow-md active:scale-[0.97]"
        >
          Shop all
          <ArrowRight
            className="h-4 w-4 transition-transform duration-300 ease-emphasized group-hover:translate-x-1"
            aria-hidden
          />
        </Link>
      </div>
    </section>
  );
}
