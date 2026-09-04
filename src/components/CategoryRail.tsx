import { Skeleton, cn } from '@/components/ui';
import type { CategoryTreeResponse } from '@/lib/types';

/**
 * The catalogue's top-level categories as a scrollable row of picture tiles, sitting above the
 * product grid.
 *
 * <p><b>Why this exists.</b> On the listing page category was only ever a {@code <select>} inside a
 * filter rail that is {@code hidden lg:block} — so on a phone it sat behind the Filters button, two
 * taps deep and invisible until opened. A shopper landing on "everything" had no visible way to
 * narrow down. Category is not a filter on a phone, it is the primary navigation, which is why every
 * grocery and fashion app puts exactly this row above the grid.
 *
 * <p><b>Roots only.</b> Drilling into children needs a second state and a way back out; the row's
 * value is that one glance shows the whole shape of the shop. Sub-categories stay in the filter
 * rail's select, which handles arbitrary depth already.
 *
 * <p>Selection is not held here. Tapping writes {@code categoryId} to the URL, the same place the
 * select and the filter chips read from, so the three controls can never disagree and a shared link
 * lands on the same view.
 */
export function CategoryRail({
  categories,
  activeId,
  onSelect,
  loading = false,
  className,
}: {
  /** Root categories; children are ignored (see above). */
  categories: CategoryTreeResponse[];
  /** The category in the URL, or '' for everything. */
  activeId: string;
  onSelect: (categoryId: string | undefined) => void;
  loading?: boolean;
  className?: string;
}) {
  if (loading) {
    return (
      <div className={cn('flex gap-4 overflow-hidden', className)} aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex w-[4.5rem] shrink-0 flex-col items-center gap-2">
            <Skeleton className="h-[4.5rem] w-[4.5rem] rounded-2xl" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    );
  }

  // One category is not a choice, and none is not a row. Either way the grid speaks for itself.
  if (categories.length < 2) return null;

  return (
    <nav aria-label="Shop by category" className={className}>
      {/* Negative margin + matching padding so the row bleeds to the screen edge on a phone — a
          scrollable strip that stops short of the edge reads as clipped rather than as scrollable.
          `snap-x` makes the flick land on a tile instead of halfway through one. */}
      <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <CategoryTile
          label="All"
          active={activeId === ''}
          onClick={() => onSelect(undefined)}
        />
        {categories.map((c) => (
          <CategoryTile
            key={c.id}
            label={c.name}
            imageUrl={c.imageUrl}
            imageAltText={c.imageAltText}
            active={activeId === c.id}
            // Tapping the active one clears it, so the row is its own way back out.
            onClick={() => onSelect(activeId === c.id ? undefined : c.id)}
          />
        ))}
      </ul>
    </nav>
  );
}

function CategoryTile({
  label,
  imageUrl,
  imageAltText,
  active,
  onClick,
}: {
  label: string;
  imageUrl?: string | null;
  imageAltText?: string | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li className="snap-start">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className="group flex w-[4.5rem] flex-col items-center gap-2 rounded-2xl focus:outline-none focus-visible:outline-none"
      >
        <span
          className={cn(
            'flex h-[4.5rem] w-[4.5rem] items-center justify-center overflow-hidden rounded-2xl',
            'bg-ink-850 transition duration-200 ease-emphasized',
            // The selected tile is ringed rather than filled: a filled swatch would fight whatever
            // photograph is inside it, and half these tiles are photographs.
            active
              ? 'ring-2 ring-brand ring-offset-2 ring-offset-ink-950'
              : 'group-hover:ring-2 group-hover:ring-ink-600 group-hover:ring-offset-2 group-hover:ring-offset-ink-950',
          )}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              // Empty alt when the merchant set none: the category name is right below as real
              // text, so describing the picture would say it twice to a screen reader.
              alt={imageAltText ?? ''}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            // No photo set: the initial, not a broken tile. Categories carry an imageUrl the admin
            // can upload — this is what shows until someone does.
            <span aria-hidden className="font-display text-h3 text-slate-400">
              {label.trim().charAt(0).toUpperCase()}
            </span>
          )}
        </span>
        <span
          className={cn(
            'line-clamp-2 text-center text-caption leading-tight transition-colors duration-200',
            active ? 'font-medium text-slate-100' : 'text-slate-400 group-hover:text-slate-100',
          )}
        >
          {label}
        </span>
      </button>
    </li>
  );
}
