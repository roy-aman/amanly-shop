import { Button } from './Button';

// ── Pagination ────────────────────────────────────────────────────────
export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number; // 0-based
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-4 pt-2">
      <p className="text-sm text-slate-500">
        Page <span className="text-slate-300">{page + 1}</span> of {totalPages}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => onChange(page - 1)}>
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => onChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
