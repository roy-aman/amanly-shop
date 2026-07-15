import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { LayoutGrid, List, PackageSearch, SlidersHorizontal } from 'lucide-react';
import { getCategoryTree, listProducts } from '@/api/catalog';
import type { CategoryTreeResponse, ProductSearchParams } from '@/lib/types';
import {
  Button,
  Drawer,
  EmptyState,
  Field,
  FilterChip,
  Input,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  cn,
} from '@/components/ui';
import { ProductGridSkeleton } from '@/components/RouteSkeletons';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import ProductCard, { type ProductCardVariant } from '@/components/ProductCard';

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
      minPrice: undefined,
      maxPrice: undefined,
      search: undefined,
      inStock: undefined,
      page: undefined,
    });
  }

  const hasActiveFilters = Boolean(categoryId || minPrice || maxPrice || search || inStock);

  // ── Data ────────────────────────────────────────────────────────────────
  // Only real backend params are sent. `inStock` is applied client-side (see below).
  const params = useMemo<ProductSearchParams>(() => {
    const p: ProductSearchParams = { page, size, sort };
    if (search) p.search = search;
    if (categoryId) p.categoryId = categoryId;
    if (minPrice) p.minPrice = Number(minPrice);
    if (maxPrice) p.maxPrice = Number(maxPrice);
    return p;
  }, [page, size, sort, search, categoryId, minPrice, maxPrice]);

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

  // ── Filter panel (shared by desktop sidebar + mobile drawer) ─────────────
  const filterPanel = (
    <div className="space-y-5">
      <Field label="Category">
        <Select value={categoryId} onChange={(e) => setFilter({ categoryId: e.target.value || undefined })}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {'  '.repeat(c.depth)}
              {c.name}
            </option>
          ))}
        </Select>
      </Field>

      <fieldset className="space-y-2">
        <legend className="rc-label">Price range</legend>
        <div className="flex items-center gap-2">
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
      </fieldset>

      <Field label="Availability">
        <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={inStock}
            onChange={(e) => setFilter({ inStock: e.target.checked ? '1' : undefined })}
            className="mt-0.5 h-4 w-4 rounded border-ink-600 bg-ink-850 text-gold-400 focus:ring-gold-400/70"
          />
          <span>
            In stock only
            <span className="mt-0.5 block text-xs text-slate-500">Filters the products loaded on this page.</span>
          </span>
        </label>
      </Field>

      {/*
        Phase 3 facets deliberately NOT built:
          • Brand / colour / size filters → WP-3.5 (no backend params)
          • Rating filter → WP-3.2 (no backend params)
          • Popularity sort → deferred: /products/top exists (WP-3.1a) but can't be
            filtered/paginated, so it can't back this page's composable sort. Needs a
            `sort=popular` key on the public search endpoint. See the SORTS comment.
        Do not add controls for these until their endpoints land.
      */}
    </div>
  );

  // ── Active-filter chips ──────────────────────────────────────────────────
  const chips = (
    <div className="flex flex-wrap items-center gap-2">
      {categoryId && (
        <FilterChip onRemove={() => setFilter({ categoryId: undefined })}>
          {categoryName ?? 'Category'}
        </FilterChip>
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
        className="rounded text-sm font-medium text-slate-400 underline-offset-2 transition hover:text-slate-200 hover:underline"
      >
        Clear all
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Shop" subtitle="Browse the full catalog." />

      <div className="lg:grid lg:grid-cols-[16rem_1fr] lg:gap-8">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4 rounded-2xl border border-ink-800 bg-ink-900/50 p-5">
            <h2 className="text-h4 text-slate-100">Filters</h2>
            {filterPanel}
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          {/* Toolbar: search + controls */}
          <div className="space-y-3 rounded-2xl border border-ink-800 bg-ink-900/50 p-4">
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
                <Button
                  variant="outline"
                  size="md"
                  className="lg:hidden"
                  onClick={() => setFiltersOpen(true)}
                >
                  <SlidersHorizontal className="mr-1.5 h-4 w-4" />
                  Filters
                  {hasActiveFilters && <span className="ml-1.5 h-2 w-2 rounded-full bg-gold-400" />}
                </Button>

                <Field className="w-full sm:w-auto">
                  <Select
                    aria-label="Sort products"
                    value={sort}
                    onChange={(e) => setFilter({ sort: e.target.value })}
                  >
                    {SORTS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </Field>

                {/* Grid / list toggle */}
                <div className="flex shrink-0 overflow-hidden rounded-lg border border-ink-600" role="group" aria-label="View mode">
                  {(['grid', 'list'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setView(mode)}
                      aria-label={mode === 'grid' ? 'Grid view' : 'List view'}
                      aria-pressed={view === mode}
                      className={cn(
                        'flex h-9 w-9 items-center justify-center transition',
                        view === mode ? 'bg-gold-400/15 text-gold-300' : 'text-slate-400 hover:bg-ink-800 hover:text-slate-200',
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
          {productsQuery.isLoading ? (
            <ProductGridSkeleton />
          ) : productsQuery.isError ? (
            <EmptyState
              icon={<PackageSearch className="h-10 w-10" />}
              title="Couldn’t load products"
              message="Something went wrong fetching the catalog. Please try again."
              action={<Button variant="outline" onClick={() => productsQuery.refetch()}>Retry</Button>}
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
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>
                  {data?.totalElements ?? 0} {data?.totalElements === 1 ? 'product' : 'products'}
                  {inStock && hiddenByStock > 0 && ` · ${hiddenByStock} hidden (out of stock) on this page`}
                </span>
                <Field>
                  <Select
                    aria-label="Results per page"
                    value={String(size)}
                    onChange={(e) => setFilter({ size: e.target.value })}
                    className="h-8 py-0 text-sm"
                  >
                    {PAGE_SIZES.map((n) => (
                      <option key={n} value={n}>
                        {n} / page
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              {view === 'grid' ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
                  {visible.map((p) => (
                    <ProductCard key={p.id} product={p} variant="grid" />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {visible.map((p) => (
                    <ProductCard key={p.id} product={p} variant="list" />
                  ))}
                </div>
              )}

              <Pagination
                page={data?.number ?? 0}
                totalPages={data?.totalPages ?? 0}
                onChange={(p) => updateParams({ page: String(p) })}
              />
            </>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      <Drawer open={filtersOpen} onOpenChange={setFiltersOpen} side="left" title="Filters">
        {filterPanel}
        {hasActiveFilters && (
          <div className="mt-6">
            <Button variant="ghost" fullWidth onClick={clearAll}>
              Clear all filters
            </Button>
          </div>
        )}
      </Drawer>
    </div>
  );
}
