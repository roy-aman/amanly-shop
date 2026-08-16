import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Download, FileUp, Info, Upload } from 'lucide-react';
import { productBulk } from '@/api/productBulk';
import { ApiError } from '@/lib/http';
import type { ProductImportIssue, ProductImportJobResponse, ProductStatus } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Badge, Button, Card, Field } from '@/components/ui';

/** How often a running job is asked about. Fast enough to feel live, slow enough
 *  that a ten-thousand-row import is not thousands of requests. */
const POLL_MS = 2000;

function isActive(job: ProductImportJobResponse | null): boolean {
  return job?.status === 'PENDING' || job?.status === 'RUNNING';
}

/**
 * Bulk catalogue upload and download.
 *
 * The whole point is the round trip: export the catalogue, edit it in a
 * spreadsheet, send it back. Rows are keyed on SKU, so the same file can be
 * imported twice without duplicating anything.
 *
 * The upload returns a job id immediately and the file is applied in the
 * background, so this polls rather than waiting on the request. Three things are
 * said out loud on screen because merchants reliably assume the opposite of each:
 * a blank cell leaves a field alone rather than clearing it, the file must be
 * UTF-8, and COMPLETED does not mean every row worked.
 */
export function BulkProductUpload({ statusFilter }: { statusFilter?: ProductStatus }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { isAdmin } = useAuth();

  const [file, setFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [job, setJob] = useState<ProductImportJobResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Poll while the job is in flight. Cleared on unmount so navigating away
  // mid-import does not leave a timer calling a dead component.
  useEffect(() => {
    if (!isActive(job)) return;
    const id = window.setInterval(async () => {
      try {
        const next = await productBulk.status(job!.id);
        setJob(next);
        if (next.status === 'COMPLETED' && !next.dryRun) {
          // Rows changed underneath the table, so the list has to be re-read.
          await qc.invalidateQueries({ queryKey: ['admin-products'] });
        }
      } catch {
        // A blip while polling is not worth destroying the report over; the next
        // tick tries again, and a persistent failure shows as a job that never
        // leaves RUNNING rather than a false "finished".
      }
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [job, qc]);

  async function onUpload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setJob(await productBulk.import(file, dryRun));
    } catch (e) {
      if (e instanceof ApiError && e.code === 'IMPORT_ALREADY_RUNNING') {
        setError('An import is already running for this store. Wait for it to finish before starting another.');
      } else if (e instanceof ApiError && e.code === 'IMPORT_FILE_TOO_LARGE') {
        setError('That file is over the 5 MB limit. Split it into smaller files.');
      } else {
        setError(e instanceof Error ? e.message : 'The file could not be uploaded.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function onExport() {
    setExporting(true);
    try {
      await productBulk.exportCsv(statusFilter ? { status: statusFilter } : {});
    } catch (e) {
      toast.error('Could not export', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setExporting(false);
    }
  }

  function reset() {
    setJob(null);
    setFile(null);
    setError(null);
    if (fileInput.current) fileInput.current.value = '';
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-h4 text-slate-100">Bulk upload</h2>
          <p className="mt-1 text-body-sm text-slate-400">
            Export the catalogue, edit it in a spreadsheet, and send it back. Rows are matched on <strong>SKU</strong>:
            an existing SKU is updated, a new one is added as a draft.
          </p>
        </div>
        <Button variant="secondary" onClick={onExport} loading={exporting}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <ul className="mt-4 space-y-1.5 text-caption text-slate-500">
        <li className="flex gap-2">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          On an existing product, a <strong>blank cell leaves that field unchanged</strong> — importing cannot clear a
          field.
        </li>
        <li className="flex gap-2">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Save from Excel as <strong>CSV UTF-8</strong>, not plain CSV, or accented names and ₹ signs arrive mangled.
        </li>
        <li className="flex gap-2">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Exporting with no products gives just the header row, which works as a blank template.
        </li>
      </ul>

      {!isAdmin ? (
        <p className="mt-4 rounded-lg border border-ink-700 bg-ink-850 p-3 text-caption text-slate-400">
          Uploading is restricted to administrators — one file can change every price in the catalogue. You can still
          export.
        </p>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-end gap-3">
            <Field label="CSV file" error={error} className="min-w-[16rem] flex-1">
              <input
                ref={fileInput}
                type="file"
                accept=".csv,text/csv"
                aria-label="CSV file"
                disabled={isActive(job)}
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setError(null);
                }}
                className="block w-full text-body-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-ink-700 file:px-3 file:py-2 file:text-slate-100 hover:file:bg-ink-600"
              />
            </Field>
            <Button onClick={onUpload} loading={busy} disabled={!file || isActive(job)}>
              <Upload className="h-4 w-4" /> {dryRun ? 'Check file' : 'Upload'}
            </Button>
          </div>

          <label className="mt-3 flex items-center gap-2 text-body-sm text-slate-300">
            <input
              type="checkbox"
              checked={dryRun}
              disabled={isActive(job)}
              onChange={(e) => setDryRun(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Check the file first, without changing anything
          </label>
          <p className="mt-1 text-caption text-slate-500">
            A check reports exactly what would happen. It cannot promise the real run will succeed — the catalogue can
            change in between.
          </p>
        </>
      )}

      {job ? <ImportReport job={job} onDismiss={reset} /> : null}
    </Card>
  );
}

function ImportReport({ job, onDismiss }: { job: ProductImportJobResponse; onDismiss: () => void }) {
  if (isActive(job)) {
    return (
      <div className="mt-5 rounded-lg border border-ink-700 bg-ink-850 p-4">
        <p className="flex items-center gap-2 text-body-sm text-slate-200">
          <FileUp className="h-4 w-4 animate-pulse" aria-hidden />
          {job.status === 'PENDING' ? 'Queued…' : 'Applying rows…'} {job.originalFilename}
        </p>
        <p className="mt-1 text-caption text-slate-500">
          This runs in the background — you can leave this page and come back.
        </p>
      </div>
    );
  }

  if (job.status === 'FAILED') {
    return (
      <div className="mt-5 rounded-lg border border-danger-700/50 bg-danger-900/20 p-4">
        <p className="flex items-center gap-2 text-body-sm text-danger-200">
          <AlertTriangle className="h-4 w-4" aria-hidden /> The file could not be used
        </p>
        <p className="mt-1 text-caption text-slate-300">{job.failureMessage}</p>
        <Button variant="ghost" size="sm" className="mt-3" onClick={onDismiss}>
          Try another file
        </Button>
      </div>
    );
  }

  const clean = job.failedCount === 0;
  return (
    <div className="mt-5 rounded-lg border border-ink-700 bg-ink-850 p-4">
      <p className="flex items-center gap-2 text-body-sm text-slate-100">
        {clean ? (
          <CheckCircle2 className="h-4 w-4 text-success-400" aria-hidden />
        ) : (
          <AlertTriangle className="h-4 w-4 text-warning-400" aria-hidden />
        )}
        {job.dryRun ? 'Checked' : 'Finished'} — {job.totalRows} row{job.totalRows === 1 ? '' : 's'} read
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone="green">
          {job.createdCount} {job.dryRun ? 'would be added' : 'added'}
        </Badge>
        <Badge tone="blue">
          {job.updatedCount} {job.dryRun ? 'would be updated' : 'updated'}
        </Badge>
        {job.failedCount > 0 ? <Badge tone="red">{job.failedCount} rejected</Badge> : null}
      </div>

      {job.dryRun && clean ? (
        <p className="mt-3 text-caption text-slate-400">
          Nothing was changed. Untick &ldquo;check the file first&rdquo; and upload again to apply it.
        </p>
      ) : null}

      {job.issues.length > 0 ? (
        <div className="mt-4">
          <p className="text-caption uppercase tracking-wider text-slate-500">
            Rows to look at{job.issuesTruncated ? ' (first 1000)' : ''}
          </p>
          <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-ink-800">
            <table className="w-full text-caption">
              <thead className="sticky top-0 bg-ink-850">
                <tr className="text-left text-slate-500">
                  <th className="px-3 py-2 font-medium">Row</th>
                  <th className="px-3 py-2 font-medium">SKU</th>
                  <th className="px-3 py-2 font-medium">What happened</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800">
                {job.issues.map((issue, i) => (
                  <IssueRow key={`${issue.line}-${issue.code}-${i}`} issue={issue} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-caption text-slate-500">
            Row numbers match your spreadsheet — the header is row 1.
          </p>
        </div>
      ) : null}

      <Button variant="ghost" size="sm" className="mt-3" onClick={onDismiss}>
        {job.dryRun ? 'Upload for real' : 'Done'}
      </Button>
    </div>
  );
}

function IssueRow({ issue }: { issue: ProductImportIssue }) {
  const isError = issue.severity === 'ERROR';
  return (
    <tr>
      <td className="px-3 py-2 tabular-nums text-slate-400">{issue.line}</td>
      <td className="px-3 py-2 text-slate-300">{issue.sku ?? '—'}</td>
      <td className="px-3 py-2">
        <span className={isError ? 'text-danger-300' : 'text-warning-300'}>{isError ? 'Rejected' : 'Applied'}</span>
        <span className="text-slate-300"> — {issue.message}</span>
      </td>
    </tr>
  );
}
