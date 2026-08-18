import { useMemo, useState, type ReactNode } from 'react';
import { activateRow } from '@/lib/rowActivation';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { cn } from './cn';
import { Skeleton } from './Skeleton';

export type SortDir = 'asc' | 'desc';
export interface SortState {
  key: string;
  dir: SortDir;
}

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** Cell renderer. Defaults to `String(row[key])`. */
  render?: (row: T) => ReactNode;
  /** Enable a sortable header. Provide `sortAccessor` (or rely on `row[key]`). */
  sortable?: boolean;
  sortAccessor?: (row: T) => string | number | null | undefined;
  align?: 'left' | 'center' | 'right';
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  getRowKey: (row: T, index: number) => string | number;
  loading?: boolean;
  loadingRows?: number;
  /** Rendered when there are no rows and not loading. */
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  /** Trailing per-row action cell (e.g. a DropdownMenu). */
  rowActions?: (row: T) => ReactNode;
  stickyHeader?: boolean;
  defaultSort?: SortState;
  /** Controlled sort. When provided with `onSortChange`, internal sorting is off. */
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  className?: string;
  /** Applied to the scroll container (e.g. `max-h-[60vh]`). */
  containerClassName?: string;
}

const ALIGN: Record<NonNullable<Column<unknown>['align']>, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

export function DataTable<T>({
  columns,
  data,
  getRowKey,
  loading = false,
  loadingRows = 5,
  empty,
  onRowClick,
  rowActions,
  stickyHeader = false,
  defaultSort,
  sort: controlledSort,
  onSortChange,
  className,
  containerClassName,
}: DataTableProps<T>) {
  const [internalSort, setInternalSort] = useState<SortState | undefined>(defaultSort);
  const isControlled = controlledSort !== undefined && onSortChange !== undefined;
  const sort = isControlled ? controlledSort : internalSort;

  const accessorFor = (col: Column<T>) =>
    col.sortAccessor ?? ((row: T) => (row as Record<string, unknown>)[col.key] as string | number | null | undefined);

  function toggleSort(col: Column<T>) {
    if (!col.sortable) return;
    const nextDir: SortDir = sort?.key === col.key && sort.dir === 'asc' ? 'desc' : 'asc';
    const next: SortState = { key: col.key, dir: nextDir };
    if (isControlled) onSortChange!(next);
    else setInternalSort(next);
  }

  const rows = useMemo(() => {
    // Only sort internally; controlled callers are expected to sort server-side.
    if (isControlled || !sort) return data;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return data;
    const accessor = accessorFor(col);
    const sorted = [...data].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
    });
    return sort.dir === 'desc' ? sorted.reverse() : sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, sort, isControlled, columns]);

  const totalCols = columns.length + (rowActions ? 1 : 0);

  return (
    <div className={cn('overflow-x-auto rounded-2xl border border-ink-700/70', containerClassName)}>
      <table className={cn('w-full border-collapse text-sm', className)}>
        <thead>
          <tr className={cn('bg-ink-900/80 backdrop-blur', stickyHeader && 'sticky top-0 z-raised')}>
            {columns.map((col) => {
              const active = sort?.key === col.key;
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={cn(
                    'border-b border-ink-700 px-4 py-3 text-overline uppercase text-slate-400',
                    ALIGN[col.align ?? 'left'],
                    col.headerClassName,
                  )}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded transition hover:text-slate-200',
                        active && 'text-gold-300',
                        col.align === 'right' && 'flex-row-reverse',
                      )}
                    >
                      {col.header}
                      {active ? (
                        sort!.dir === 'asc' ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3.5 w-3.5 text-slate-600" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
            {rowActions && <th scope="col" className="border-b border-ink-700 px-4 py-3 text-right" aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: loadingRows }).map((_, r) => (
              <tr key={`sk-${r}`} className="border-b border-ink-800 last:border-b-0">
                {Array.from({ length: totalCols }).map((_, c) => (
                  <td key={c} className="px-4 py-3.5">
                    <Skeleton className={cn('h-3.5', c === 0 ? 'w-1/2' : 'w-3/4')} />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={totalCols} className="px-4 py-12 text-center text-sm text-slate-400">
                {empty ?? 'No results.'}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={getRowKey(row, i)}
                onClick={onRowClick ? activateRow(() => onRowClick(row)) : undefined}
                className={cn(
                  'border-b border-ink-800 transition last:border-b-0',
                  onRowClick && 'cursor-pointer hover:bg-ink-800/50',
                )}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-4 py-3.5 text-slate-200', ALIGN[col.align ?? 'left'], col.className)}>
                    {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
                {rowActions && (
                  <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    {rowActions(row)}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
