import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CalendarSearch } from 'lucide-react';

import { listServiceCategories, listServices } from '@/api/services';
import { useBookingsEnabled } from '@/lib/useBookingsGate';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { usePageMeta } from '@/lib/usePageMeta';
import { EmptyState, FilterChip, Pagination, SearchInput } from '@/components/ui';
import { ProductGridSkeleton } from '@/components/RouteSkeletons';
import ServiceCard from '@/components/ServiceCard';
import NotFound from '@/pages/NotFound';

const DEFAULT_SIZE = 12;

/**
 * The service menu.
 *
 * Shaped like the product listing on purpose — same URL-synced filters, same
 * grid, same pagination — because a shopper should not have to learn a second
 * set of controls to browse the other half of a shop. What is deliberately
 * missing is everything retail-specific: no price band, no stock toggle, no sort
 * control. Services come back in the order the merchant arranged them, which for
 * a menu is a considered running order rather than an arbitrary default, and
 * offering "sort by price" would throw that away.
 *
 * A store that does not take bookings renders the 404 page rather than an empty
 * menu: without the entitlement every call under here answers 404 anyway, and a
 * page of failed requests is a worse answer than "this address has no such page".
 */
export default function Services() {
  const { enabled, loading: gateLoading } = useBookingsEnabled();
  const [searchParams, setSearchParams] = useSearchParams();

  useDocumentTitle('Services');
  usePageMeta({
    description: 'Browse our services and book an appointment online.',
    canonicalPath: '/services',
  });

  const categoryId = searchParams.get('categoryId') ?? '';
  const q = searchParams.get('q') ?? '';
  const page = Number(searchParams.get('page') ?? '0');

  /** Merge into the URL, dropping empties so a cleared filter leaves no trace,
   *  and resetting the page — page 4 of a different filter is nowhere. */
  const setFilter = (patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const categoriesQuery = useQuery({
    queryKey: ['service-categories'],
    queryFn: listServiceCategories,
    staleTime: 5 * 60_000,
    enabled,
  });

  const servicesQuery = useQuery({
    queryKey: ['services', { categoryId, q, page }],
    queryFn: () => listServices({ categoryId: categoryId || undefined, q: q || undefined, page, size: DEFAULT_SIZE }),
    placeholderData: keepPreviousData,
    enabled,
  });

  if (gateLoading) return <ProductGridSkeleton />;
  if (!enabled) return <NotFound />;

  const services = servicesQuery.data?.content ?? [];
  const categories = categoriesQuery.data ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-display-sm font-semibold text-slate-100">Services</h1>
        <p className="mt-2 max-w-2xl text-body text-slate-400">
          Choose what you would like, pick a time that suits you, and pay when you come in.
        </p>
      </header>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <FilterChip selected={!categoryId} onClick={() => setFilter({ categoryId: '' })}>
              All
            </FilterChip>
            {categories.map((category) => (
              <FilterChip
                key={category.id}
                selected={categoryId === category.id}
                onClick={() => setFilter({ categoryId: category.id })}
              >
                {category.name}
              </FilterChip>
            ))}
          </div>
        )}

        <div className="sm:w-64">
          <SearchInput
            defaultValue={q}
            onSearch={(value) => setFilter({ q: value })}
            placeholder="Search services"
          />
        </div>
      </div>

      {servicesQuery.isLoading ? (
        <ProductGridSkeleton />
      ) : servicesQuery.isError ? (
        <EmptyState
          icon={<CalendarSearch className="h-6 w-6" aria-hidden />}
          title="We couldn’t load the menu"
          message="Something went wrong at our end. Please try again in a moment."
        />
      ) : services.length === 0 ? (
        <EmptyState
          icon={<CalendarSearch className="h-6 w-6" aria-hidden />}
          title={q || categoryId ? 'Nothing matches that' : 'No services yet'}
          message={
            q || categoryId
              ? 'Try a different search, or browse everything on offer.'
              : 'This shop has not published its services yet. Please check back soon.'
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>

          {(servicesQuery.data?.totalPages ?? 0) > 1 && (
            <div className="mt-10">
              <Pagination
                page={servicesQuery.data?.number ?? 0}
                totalPages={servicesQuery.data?.totalPages ?? 0}
                onChange={(next) => {
                  const params = new URLSearchParams(searchParams);
                  params.set('page', String(next));
                  setSearchParams(params, { replace: true });
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
