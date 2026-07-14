import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from './cn';

/**
 * SearchInput — text input with a leading search icon, a clear button, and a
 * debounced `onSearch` callback (fires `delay` ms after typing stops, and
 * immediately on clear). Uncontrolled by default via `defaultValue`.
 */
export function SearchInput({
  defaultValue = '',
  onSearch,
  delay = 300,
  placeholder = 'Search…',
  className,
  'aria-label': ariaLabel = 'Search',
}: {
  defaultValue?: string;
  onSearch: (value: string) => void;
  delay?: number;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  // Keep the latest callback without resubscribing the debounce effect.
  const onSearchRef = useRef(onSearch);
  useEffect(() => {
    onSearchRef.current = onSearch;
  });

  function schedule(next: string) {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearchRef.current(next), delay);
  }

  function clear() {
    if (timer.current) clearTimeout(timer.current);
    setValue('');
    onSearchRef.current('');
  }

  // Clean up a pending timer on unmount.
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => schedule(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="rc-input pl-9 pr-9 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value && (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-slate-500 transition hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
