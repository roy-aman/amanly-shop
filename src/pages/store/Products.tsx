import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { LayoutGrid, List, PackageSearch, SlidersHorizontal } from 'lucide-react';
import { getCategoryTree, listBrands, listProducts } from '@/api/catalog';
import type { CategoryTreeResponse, ProductSearchParams } from '@/lib/types';
import {
  Button,
  Drawer,
  EmptyState,
  FilterChip,
  Input,
  Pagination,
  SearchInput,
  Select,
  cn,
} from '@/components/ui';
import { ProductGridSkeleton } from '@/components/RouteSkeletons';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import ProductCard, { type ProductCardVariant } from '@/components/ProductCard';
import { BannerSlot } from '@/components/BannerSlot';

// Sort options map to the real backend-sortable fields (createdAt / price / name).
// A "popularity" sort is intentionally absent: WP-3.1a ships /products/top (used
// by the Home best-sellers rail), but that endpoint does NOT compose with this
// page's category/price/stock/search filters or pagination — wiring it into this
// URL-synced sort would silently ignore active filters. Deferred until the public
// search endpoint gains a real `sort=popular` key. Rating sort → WP-3.2.
const SORTS = [
  { value: 'createdAt,desc', label: 'Newest' },
  { value: 'price,asc', label: 'Price: low to high' },
  { value: 'price,desc', label: 'Price: high to low' },
  { value: 'name,asc', label: 'Name: A–Z' },
];
const DEFAULT_SORT = 'createdAt,desc';

const PAGE_SIZES = [12, 24, 48];
const DEFAULT_SIZE = 12;

const VIEW_STORAGE_KEY = 'rc-plp-view';

/** Flatten the category tree (roots + descendants) into indent-tagged options for a single-select. */
function flattenCategories(nodes: CategoryTreeResponse[], depth = 0): { id: string; name: string; depth: number }[] {
  return nodes.flatMap((n) => [
    { id: n.id, name: n.name, depth },
    ...flattenCategories(n.children ?? [], depth + 1),
  ]);
}

function readView(): ProductCardVariant {
  if (typeof window === 'undefined') return 'grid';
  return window.localStorage.getItem(VIEW_STORAGE_KEY) === 'list' ? 'list' : 'grid';
}

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  useDocumentTitle('Shop');

  // ── URL-synced state (shareable, back/forward-safe) ─────────────────────
  const categoryId = searchParams.get('categoryId') ?? '';
  const brandId = searchParams.get('brandId') ?? '';
  const minPrice = searchParams.get('minPrice') ?? '';
  const maxPrice = searchParams.get('maxPrice') ?? '';
  const sort = searchParams.get('sort') ?? DEFAULT_SORT;
  const search = searchParams.get('search') ?? '';
  const inStock = searchParams.get('inStock') === '1';
  const page = Number(searchParams.get('page') ?? '0');
  const size = Number(searchParams.get('size') ?? String(DEFAULT_SIZE));

  // View mode (grid/list) is a display preference — persisted in localStorage, not the URL.
  const [view, setView] = useState<ProductCardVariant>(readView);
  useEffect(() => {
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  // Mobile filter drawer.
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Local, uncommitted price inputs (committed to the URL on blur / Enter to avoid a
  // refetch on every keystroke). Re-sync when the URL changes externally (back button).
  const [minInput, setMinInput] = useState(minPrice);
  const [maxInput, setMaxInput] = useState(maxPrice);
  useEffect(() => setMinInput(minPrice), [minPrice]);
  useEffect(() => setMaxInput(maxPrice), [maxPrice]);

  const categoriesQuery = useQuery({ queryKey: ['categoryTree'], queryFn: getCategoryTree });
  const categories = useMemo(() => flattenCategories(categoriesQuery.data ?? []), [categoriesQuery.data]);
  const categoryName = categories.find((c) => c.id === categoryId)?.name;

  const brandsQuery = useQuery({ queryKey: ['brands'], queryFn: listBrands });
  const brands = brandsQuery.data ?? [];
  const brandName = brands.find((b) => b.id === brandId)?.name;

  /** Merge query-param updates; empty/undefined values are removed. Uses replace so
   *  filter tweaks don't spam browser history. */
  function updateParams(next: Record<string, string | undefined>) {
    const merged = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(next)) {
      if (value == null || value === '') merged.delete(key);
      else merged.set(key, value);
    }
    setSearchParams(merged, { replace: true });
  }

  // Any filter change resets to the first page; page/view/size-preserving changes pass page through.
  function setFilter(next: Record<string, string | undefined>) {
    updateParams({ ...next, page: undefined });
  }

  function commitPrice(key: 'minPrice' | 'maxPrice', raw: string) {
    const trimmed = raw.trim();
    // Ignore invalid/negative input; treat empty as "cleared".
    const normalized = trimmed === '' ? undefined : String(Math.max(0, Number(trimmed) || 0));
    if ((normalized ?? '') !== (key === 'minPrice' ? minPrice : maxPrice)) {
      setFilter({ [key]: normalized });
    }
  }

  function clearAll() {
    updateParams({
      categoryId: undefined,
      brandId: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      search: undefined,
      inStock: undefined,
      page: undefined,
    });
  }

  const hasActiveFilters = Boolean(categoryId || brandId || minPrice || maxPrice || search || inStock);

  // ── Data ────────────────────────────────────────────────────────────────
  // Only real backend params are sent. `inStock` is applied client-side (see below).
  const params = useMemo<ProductSearchParams>(() => {
    const p: ProductSearchParams = { page, size, sort };
    if (search) p.search = search;
    if (categoryId) p.categoryId = categoryId;
    if (brandId) p.brandId = brandId;
    if (minPrice) p.minPrice = Number(minPrice);
    if (maxPrice) p.maxPrice = Number(maxPrice);
    return p;
  }, [page, size, sort, search, categoryId, brandId, minPrice, maxPrice]);

  const productsQuery = useQuery({
    queryKey: ['products', params],
    queryFn: () => listProducts(params),
    placeholderData: keepPreviousData,
  });

  const data = productsQuery.data;
  // Availability has NO backend param, so "in stock" filters the CURRENTLY LOADED page
  // client-side (stockQuantity > 0). It is URL-synced (?inStock=1) so the choice is still
  // shareable/back-safe, but it does not affect server-side pagination — labelled as such in the UI.
  const visible = useMemo(
    () => (data ? (inStock ? data.content.filter((p) => p.stockQuantity > 0) : data.content) : []),
    [data, inStock],
  );
  const hiddenByStock = data ? data.content.length - visible.length : 0;

  // ── Filter panel (shared by desktop rail + mobile drawer) ────────────────
  // Filters are a rail of hairline-separated groups, not a bordered card: on a
  // light page a boxed sidebar competes with the products it is meant to serve.
  const filterPanel = (
    <div className="divide-y divide-ink-700">
      <FilterGroup label="Category">
        <Select
          aria-label="Category"
          value={categoryId}
          onChange={(e) => setFilter({ categoryId: e.target.value || undefined })}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {'  '.repeat(c.depth)}
              {c.name}
            </option>
          ))}
        </Select>
      </FilterGroup>

      {brands.length > 0 && (
        <FilterGroup label="Brand">
          <Select
            aria-label="Brand"
            value={brandId}
            onChange={(e) => setFilter({ brandId: e.target.value || undefined })}
          >
            <option value="">All brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </FilterGroup>
      )}

      <FilterGroup label="Price" as="fieldset">
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            aria-label="Minimum price"
            value={minInput}
            onChange={(e) => setMinInput(e.target.value)}
            onBlur={() => commitPrice('minPrice', minInput)}
            onKeyDown={(e) => e.key === 'Enter' && commitPrice('minPrice', minInput)}
            placeholder="Min"
          />
          <span className="text-slate-500">–</span>
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            aria-label="Maximum price"
            value={maxInput}
            onChange={(e) => setMaxInput(e.target.value)}
            onBlur={() => commitPrice('maxPrice', maxInput)}
            onKeyDown={(e) => e.key === 'Enter' && commitPrice('maxPrice', maxInput)}
            placeholder="Max"
          />
        </div>
      </FilterGroup>

      <FilterGroup label="Availability">
        <label className="flex cursor-pointer items-start gap-2.5 text-body-sm text-slate-300">
          <input
            type="checkbox"
            checked={inStock}
            onChange={(e) => setFilter({ inStock: e.target.checked ? '1' : undefined })}
            // `accent-*`, not `text-*`: without the Tailwind forms plugin a
            // native checkbox ignores text colour and renders browser blue.
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span>
            In stock only
            <span className="mt-0.5 block text-caption text-slate-500">
              Filters the products loaded on this page.
            </span>
          </span>
        </label>
      </FilterGroup>

      {/*
        Phase 3 facets deliberately NOT built:
          • Colour / size filters → no dedicated backend params (variant options aren't
            a public search facet). Brand filter IS built (WP-3.5, ?brandId=…) above.
          • Rating filter + rating sort → STILL deferred after WP-3.2b. The public
            search endpoint (/api/v1/products) exposes no `minRating` filter or
            `sort=rating` key — ProductSummaryResponse now carries ratingAvg/ratingCount
            (shown as stars on the cards), but there's nothing to filter/sort on
            server-side, and doing it client-side would only reorder the current page.
            Needs `minRating`/`sort=rating` on the public search endpoint.
          • Popularity sort → deferred: /products/top exists (WP-3.1a) but can't be
            filtered/paginated, so it can't back this page's composable sort. Needs a
            `sort=popular` key on the public search endpoint. See the SORTS comment.
        Do not add controls for these until their endpoints land.
      */}
    </div>
  );

  // ── Active-filter chips ──────────────────────────────────────────────────
  const chips = (
    <div className="flex flex-wrap items-center gap-2 pt-4">
      {categoryId && (
        <FilterChip onRemove={() => setFilter({ categoryId: undefined })}>
          {categoryName ?? 'Category'}
        </FilterChip>
      )}
      {brandId && (
        <FilterChip onRemove={() => setFilter({ brandId: undefined })}>{brandName ?? 'Brand'}</FilterChip>
      )}
      {(minPrice || maxPrice) && (
        <FilterChip onRemove={() => setFilter({ minPrice: undefined, maxPrice: undefined })}>
          {minPrice ? `$${minPrice}` : 'Any'} – {maxPrice ? `$${maxPrice}` : 'Any'}
        </FilterChip>
      )}
      {search && <FilterChip onRemove={() => setFilter({ search: undefined })}>“{search}”</FilterChip>}
      {inStock && <FilterChip onRemove={() => setFilter({ inStock: undefined })}>In stock</FilterChip>}
      <button
        type="button"
        onClick={clearAll}
        className="rounded text-body-sm text-slate-500 underline-offset-4 transition hover:text-slate-100 hover:underline"
      >
        Clear all
      </button>
    </div>
  );

  const resultCount = data?.totalElements ?? 0;

  return (
    <div>
      {/* Renders nothing at all unless the merchant has a listing banner booked. */}
      <BannerSlot placement="PLP_STRIP" className="pb-6" />

      {/* Page head — the count sits with the title rather than in a toolbar strip,
          so the first thing read is "what am I looking at, and how much of it". */}
      <header className="border-b border-ink-700 pb-6">
        <h1 className="font-display text-h1 text-slate-100">
          {categoryName ?? (search ? `“${search}”` : 'Shop')}
        </h1>
        <p className="mt-2 text-body-sm text-slate-400">
          {productsQuery.isLoading
            ? 'Loading the catalog…'
            : `${resultCount} ${resultCount === 1 ? 'piece' : 'pieces'}`}
        </p>
      </header>

      <div className="mt-8 lg:grid lg:grid-cols-[15rem_1fr] lg:gap-12">
        {/* Desktop filter rail */}
        <aside className="hidden lg:block">
          <div className="sticky top-28">
            <p className="text-overline uppercase text-slate-500">Filter</p>
            <div className="mt-4 border-t border-ink-700">{filterPanel}</div>
          </div>
        </aside>

        <div className="min-w-0">
          {/* Toolbar — one hairline-separated row, no panel. */}
          <div className="border-b border-ink-700 pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <SearchInput
                key={`search-${search}`}
                defaultValue={search}
                onSearch={(v) => setFilter({ search: v || undefined })}
                placeholder="Search products…"
                aria-label="Search products"
                className="flex-1"
              />
              <div className="flex items-center gap-2">
                {/* Mobile filter trigger */}
                <Button variant="outline" size="md" className="lg:hidden" onClick={() => setFiltersOpen(true)}>
                  <SlidersHorizontal className="mr-1.5 h-4 w-4" />
                  Filters
                  {hasActiveFilters && <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-brand" />}
                </Button>

                <Select
                  aria-label="Sort products"
                  value={sort}
                  onChange={(e) => setFilter({ sort: e.target.value })}
                  className="w-auto"
                >
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>

                {/* Grid / list toggle — selected state is ink, not gold: it reports
                    a preference, and gold is reserved for decoration. */}
                <div
                  className="flex shrink-0 overflow-hidden rounded-lg border border-ink-600"
                  role="group"
                  aria-label="View mode"
                >
                  {(['grid', 'list'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setView(mode)}
                      aria-label={mode === 'grid' ? 'Grid view' : 'List view'}
                      aria-pressed={view === mode}
                      className={cn(
                        'flex h-10 w-10 items-center justify-center transition',
                        view === mode
                          ? 'bg-primary text-primary-fg'
                          : 'text-slate-400 hover:bg-ink-800 hover:text-slate-100',
                      )}
                    >
                      {mode === 'grid' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {hasActiveFilters && chips}
          </div>

          {/* Results */}
          <div className="pt-8">
            {productsQuery.isLoading ? (
              <ProductGridSkeleton />
            ) : productsQuery.isError ? (
              <EmptyState
                icon={<PackageSearch className="h-10 w-10" />}
                title="Couldn’t load products"
                message="Something went wrong fetching the catalog. Please try again."
                action={
                  <Button variant="outline" onClick={() => productsQuery.refetch()}>
                    Retry
                  </Button>
                }
              />
            ) : visible.length === 0 ? (
              <EmptyState
                icon={<PackageSearch className="h-10 w-10" />}
                title="No products found"
                message={
                  inStock && (data?.content.length ?? 0) > 0
                    ? 'No in-stock products on this page. Try removing the in-stock filter or viewing another page.'
                    : 'Try adjusting your filters or search terms.'
                }
                action={
                  hasActiveFilters ? (
                    <Button variant="outline" onClick={clearAll}>
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                {inStock && hiddenByStock > 0 && (
                  <p className="mb-6 text-caption text-slate-500">
                    {hiddenByStock} out-of-stock {hiddenByStock === 1 ? 'piece' : 'pieces'} hidden on this page.
                  </p>
                )}

                {view === 'grid' ? (
                  // Generous row gap: portrait cards need vertical air between rows
                  // or the grid reads as a wall.
                  <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 xl:grid-cols-4">
                    {visible.map((p, i) => (
                      // Keyed by product id, so a card that survives a filter
                      // change keeps its DOM node and does NOT replay the
                      // entrance — only genuinely new results animate in, which
                      // is what makes the stagger informative rather than decorative.
                      <div
                        key={p.id}
                        className="rc-enter"
                        // Capped at 8: past the first two rows the delay is only
                        // making the reader wait.
                        style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
                      >
                        <ProductCard product={p} variant="grid" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {visible.map((p) => (
                      <ProductCard key={p.id} product={p} variant="list" />
                    ))}
                  </div>
                )}

                <div className="mt-14 flex flex-col items-center gap-6 border-t border-ink-700 pt-8 sm:flex-row sm:justify-between">
                  <Select
                    aria-label="Results per page"
                    value={String(size)}
                    onChange={(e) => setFilter({ size: e.target.value })}
                    className="w-auto"
                  >
                    {PAGE_SIZES.map((n) => (
                      <option key={n} value={n}>
                        {n} per page
                      </option>
                    ))}
                  </Select>

                  <Pagination
                    page={data?.number ?? 0}
                    totalPages={data?.totalPages ?? 0}
                    onChange={(p) => updateParams({ page: String(p) })}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter drawer */}
      <Drawer open={filtersOpen} onOpenChange={setFiltersOpen} side="left" title="Filters">
        <div className="border-t border-ink-700">{filterPanel}</div>
        {hasActiveFilters && (
          <div className="mt-6">
            <Button variant="outline" fullWidth onClick={clearAll}>
              Clear all filters
            </Button>
          </div>
        )}
      </Drawer>
    </div>
  );
}

/** One hairline-separated block in the filter rail. */
function FilterGroup({
  label,
  children,
  as = 'div',
}: {
  label: string;
  children: ReactNode;
  as?: 'div' | 'fieldset';
}) {
  const Wrapper = as;
  const Label = as === 'fieldset' ? 'legend' : 'p';
  return (
    <Wrapper className="py-5">
      <Label className="mb-3 block text-overline uppercase text-slate-500">{label}</Label>
      {children}
    </Wrapper>
  );
}
