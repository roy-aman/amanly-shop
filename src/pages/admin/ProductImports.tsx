import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronDown, ChevronRight, FileSpreadsheet, Loader2 } from 'lucide-react';
import { productBulk } from '@/api/productBulk';
import type { ProductImportJobResponse } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { Badge, Card, EmptyState, PageHeader, Pagination, SkeletonTable } from '@/components/ui';
import { ImportIssueTable, importStatusTone, isImportActive } from '@/components/admin/BulkProductUpload';

const PAGE_SIZE = 15;

/**
 * Every catalogue upload this store has made, newest first.
 *
 * <p>Separate from the upload control on Inventory because the two answer different questions —
 * "apply this file" is a task, "what happened to the one I ran this morning" is a record. A job runs
 * in the background and the report outlives the page that started it, so without somewhere to look
 * it up, navigating away lost the only account of what a file did.
 *
 * <p>The list refreshes itself only while something is actually running. Polling a page of finished
 * jobs forever would be a request every few seconds for a table that cannot change.
 */
export default function ProductImports() {
  useDocumentTitle('Import history');

  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'product-imports', page],
    queryFn: () => productBulk.history({ page, size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    // Only while a job is in flight — see the class note.
    refetchInterval: (query) =>
      (query.state.data?.content ?? []).some(isImportActive) ? 2000 : false,
  });

  const rows = data?.content ?? [];
  const running = rows.filter(isImportActive).length;

  return (
    <div>
      <Link
        to="/admin/inventory"
        className="mb-4 inline-flex items-center gap-2 text-body-sm text-slate-400 transition hover:text-slate-100"
      >
        <ArrowLeft className="h-4 w-4" /> Inventory
      </Link>

      <PageHeader
        title="Import history"
        subtitle="Every catalogue file uploaded to this store, and what it did."
      />

      {running > 0 ? (
        <Card className="mb-4 flex items-center gap-3 p-4">
          <Loader2 className="h-4 w-4 animate-spin text-slate-300" aria-hidden />
          <p className="text-body-sm text-slate-200">
            {running === 1 ? 'An import is running' : `${running} imports are running`} — this list is updating itself.
          </p>
        </Card>
      ) : null}

      <Card className="p-4">
        {isLoading ? (
          <SkeletonTable rows={6} columns={5} />
        ) : isError ? (
          <EmptyState title="Could not load imports" message={(error as Error)?.message} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<FileSpreadsheet className="h-10 w-10" />}
            title="No imports yet"
            message="Upload a CSV from the inventory page and it will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2 font-medium">File</th>
                  <th className="px-3 py-2 font-medium">Uploaded</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Rows</th>
                  <th className="px-3 py-2 font-medium text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800">
                {rows.map((job) => (
                  <ImportRow
                    key={job.id}
                    job={job}
                    expanded={expanded === job.id}
                    onToggle={() => setExpanded(expanded === job.id ? null : job.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.totalPages > 1 ? (
          <Pagination page={page} totalPages={data.totalPages} onChange={setPage} />
        ) : null}
      </Card>
    </div>
  );
}

function ImportRow({
  job,
  expanded,
  onToggle,
}: {
  job: ProductImportJobResponse;
  expanded: boolean;
  onToggle: () => void;
}) {
  const active = isImportActive(job);
  const hasDetail = job.issues.length > 0 || !!job.failureMessage;

  return (
    <>
      <tr className="transition hover:bg-ink-800/40">
        <td className="px-3 py-3">
          <button
            type="button"
            onClick={onToggle}
            disabled={!hasDetail}
            className="flex items-center gap-2 text-left text-slate-200 disabled:cursor-default"
            aria-expanded={expanded}
            aria-label={hasDetail ? `Show what happened to ${job.originalFilename}` : job.originalFilename}
          >
            {hasDetail ? (
              expanded ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
              )
            ) : (
              <span className="w-4" />
            )}
            <span className="truncate">{job.originalFilename}</span>
            {job.dryRun ? <Badge tone="gray">Check only</Badge> : null}
          </button>
        </td>
        <td className="px-3 py-3 text-slate-400">{formatDate(job.submittedAt)}</td>
        <td className="px-3 py-3">
          <span className="inline-flex items-center gap-2">
            {active ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" aria-hidden /> : null}
            <Badge tone={importStatusTone(job)}>{job.status}</Badge>
          </span>
        </td>
        <td className="px-3 py-3 text-right tabular-nums text-slate-300">{job.totalRows}</td>
        <td className="px-3 py-3 text-right text-slate-300">
          {job.status === 'FAILED' ? (
            <span className="text-danger-300">not applied</span>
          ) : active ? (
            <span className="text-slate-500">—</span>
          ) : (
            <span className="tabular-nums">
              {job.createdCount} added · {job.updatedCount} updated
              {job.failedCount > 0 ? <span className="text-danger-300"> · {job.failedCount} rejected</span> : null}
            </span>
          )}
        </td>
      </tr>

      {expanded && hasDetail ? (
        <tr>
          <td colSpan={5} className="bg-ink-900/50 px-3 py-4">
            {job.failureMessage ? (
              <p className="text-body-sm text-danger-200">{job.failureMessage}</p>
            ) : (
              <ImportIssueTable job={job} />
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}
