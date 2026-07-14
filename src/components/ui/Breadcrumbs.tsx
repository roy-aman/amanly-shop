import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from './cn';

export interface Crumb {
  label: string;
  /** Omit `to` on the last/current crumb so it renders as plain text. */
  to?: string;
}

/**
 * Breadcrumbs — accessible trail (`nav[aria-label]` + `aria-current="page"` on
 * the last crumb). Pass an ordered list; the final item is rendered as the
 * current page.
 */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-slate-400">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <Fragment key={`${item.label}-${i}`}>
              <li className="inline-flex min-w-0 items-center">
                {item.to && !last ? (
                  <Link to={item.to} className="truncate rounded transition hover:text-slate-200">
                    {item.label}
                  </Link>
                ) : (
                  <span className="truncate text-slate-300" aria-current={last ? 'page' : undefined}>
                    {item.label}
                  </span>
                )}
              </li>
              {!last && <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" aria-hidden />}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
