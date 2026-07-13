import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { PackageSearch, Search } from 'lucide-react';
import { listCategories, listProducts } from '@/api/catalog';
import type { ProductSearchParams } from '@/lib/types';
import { Field, Input, Select, Pagination, PageLoader, EmptyState, PageHeader } from '@/components/ui';
import ProductCard from '@/components/ProductCard';

const SORTS = [
  { value: 'createdAt,desc', label: 'Newest' },
  { value: 'price,asc', label: 'Price: low to high' },
  { value: 'price,desc', label: 'Price: high to low' },
  { value: 'name,asc', label: 'Name' },
];

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Local search text (debounced into the URL).
  const [searchText, setSearchText] = useState(searchParams.get('search') ?? '');

  const categoryId = searchParams.get('categoryId') ?? '';
  const minPrice = searchParams.get('minPrice') ?? '';
  const maxPrice = searchParams.get('maxPrice') ?? '';
  const sort = searchParams.get('sort') ?? 'createdAt,desc';
  const search = searchParams.get('search') ?? '';
  const page = Number(searchParams.get('page') ?? '0');

  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: listCategories });

  // Keep the input in sync if the URL changes externally (e.g. back button).
  useEffect(() => {
    setSearchText(searchParams.get('search') ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('search')]);

  // Debounce the search text into the URL.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (searchText === search) return;
      updateParams({ search: searchText || undefined, page: undefined });
    }, 350);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  function updateParams(next: Record<string, string | undefined>) {
    const merged = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(next)) {
      if (value == null || value === '') merged.delete(key);
      else merged.set(key, value);
    }
    setSearchParams(merged, { replace: true });
  }

  const params = useMemo<ProductSearchParams>(() => {
    const p: ProductSearchParams = { page, size: 12, sort };
    if (search) p.search = search;
    if (categoryId) p.categoryId = categoryId;
    if (minPrice) p.minPrice = Number(minPrice);
    if (maxPrice) p.maxPrice = Number(maxPrice);
    return p;
  }, [page, sort, search, categoryId, minPrice, maxPrice]);

  const productsQuery = useQuery({
    queryKey: ['products', params],
    queryFn: () => listProducts(params),
    placeholderData: keepPreviousData,
  });

  const data = productsQuery.data;
  const categories = (categoriesQuery.data ?? []).filter((c) => c.active);

  return (
    <div className="space-y-6">
      <PageHeader title="Shop" subtitle="Browse the full catalog." />

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-ink-800 bg-ink-900/50 p-4 sm:grid-cols-2 lg:grid-cols-6">
        <Field label="Search" className="lg:col-span-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search products…"
              className="pl-9"
            />
          </div>
        </Field>

        <Field label="Category">
          <Select value={categoryId} onChange={(e) => updateParams({ categoryId: e.target.value || undefined, page: undefined })}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Min price">
          <Input
            type="number"
            min={0}
            value={minPrice}
            onChange={(e) => updateParams({ minPrice: e.target.value || undefined, page: undefined })}
            placeholder="0"
          />
        </Field>

        <Field label="Max price">
          <Input
            type="number"
            min={0}
            value={maxPrice}
            onChange={(e) => updateParams({ maxPrice: e.target.value || undefined, page: undefined })}
            placeholder="Any"
          />
        </Field>

        <Field label="Sort by">
          <Select value={sort} onChange={(e) => updateParams({ sort: e.target.value, page: undefined })}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {/* Results */}
      {productsQuery.isLoading ? (
        <PageLoader />
      ) : !data || data.content.length === 0 ? (
        <EmptyState
          icon={<PackageSearch className="h-10 w-10" />}
          title="No products found"
          message="Try adjusting your filters or search terms."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {data.content.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          <Pagination page={data.number} totalPages={data.totalPages} onChange={(p) => updateParams({ page: String(p) })} />
        </>
      )}
    </div>
  );
}
