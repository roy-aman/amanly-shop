import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileUp,
  History,
  Info,
  Upload,
  UploadCloud,
  X,
} from 'lucide-react';
import { productBulk } from '@/api/productBulk';
import { ApiError } from '@/lib/http';
import type { ProductImportIssue, ProductImportJobResponse, ProductStatus } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Badge, Button, Card } from '@/components/ui';

/** How often a running job is asked about. Fast enough to feel live, slow enough
 *  that a ten-thousand-row import is not thousands of requests. */
const POLL_MS = 2000;

/** What the file picker offers. Workbooks first: Excel's CSV export flattens a 13-digit barcode to
 *  8.90123E+12, and those digits cannot be recovered from the file afterwards. */
const ACCEPTED =
  '.xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';

/** PENDING and RUNNING both mean "keep polling". Shared with the history page. */
export function isImportActive(job: ProductImportJobResponse | null): boolean {
  return job?.status === 'PENDING' || job?.status === 'RUNNING';
}

/**
 * COMPLETED is not the same as "went well" — it means the file was read to the end. A file whose
 * every row was rejected still COMPLETED, so a plain green badge would be a lie; that case is
 * coloured as the warning it is.
 */
export function importStatusTone(job: ProductImportJobResponse): 'green' | 'amber' | 'red' | 'blue' {
  if (job.status === 'FAILED') return 'red';
  if (isImportActive(job)) return 'blue';
  return job.failedCount > 0 ? 'amber' : 'green';
}

const isActive = isImportActive;

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Bulk catalogue upload and download.
 *
 * The whole point is the round trip: export the catalogue, edit it in Excel, send it back. Rows are
 * keyed on SKU, so the same file can be imported twice without duplicating anything.
 *
 * <p><b>Why it rests as a single strip.</b> This shares the inventory page with the product table,
 * which is what an admin actually came for. Importing is occasional and exporting is one click, so
 * the card opens only when asked — or when a file is dragged onto it — instead of spending half the
 * screen on small print about a job nobody is doing yet.
 *
 * <p>The upload returns a job id immediately and the file is applied in the background, so this
 * polls rather than waiting on the request. Three things are said out loud because merchants
 * reliably assume the opposite of each: a blank cell leaves a field alone rather than clearing it,
 * a CSV must be UTF-8, and COMPLETED does not mean every row worked.
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
  const [excelBom, setExcelBom] = useState(true);
  const [open, setOpen] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Holding a file, or a report, is itself a request to be open: a merchant who just dropped a
  // workbook should not have to find the button that reveals what happened to it.
  const panelOpen = open || !!file || !!job;

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

  /**
   * @param mode check or apply. Passed in rather than read from state so "Apply for real" can
   *             resubmit the file already on screen. That button used only to clear the form — the
   *             one control named as the thing that imports was the one that imported nothing.
   */
  async function onUpload(mode: boolean) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setJob(await productBulk.import(file, mode));
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
      await productBulk.exportCsv(statusFilter ? { status: statusFilter } : {}, excelBom);
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

  /** Applies the file that was just checked, keeping it selected. */
  function applyForReal() {
    setDryRun(false);
    setJob(null);
    void onUpload(false);
  }

  function onDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      setFile(dropped);
      setError(null);
    }
  }

  return (
    // The drag handlers sit on a wrapper rather than on Card: Card is a presentational primitive
    // with no DOM passthrough, and widening its API for one caller would be the wrong trade.
    <div
      onDragOver={(e: DragEvent<HTMLDivElement>) => {
        if (!isAdmin || isActive(job)) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={isAdmin ? onDrop : undefined}
    >
      <Card className="p-4">
      {/* Resting state: one strip. Everything below it is opt-in. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <FileSpreadsheet className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-body-sm font-medium text-slate-100">Bulk upload</h2>
            <p className="truncate text-caption text-slate-500">
              Export, edit in Excel, send the workbook back — rows match on <strong>SKU</strong>.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {/* A job outlives the page that started it, so there has to be somewhere
              to look up what this morning's file actually did. */}
          <Link
            to="/admin/inventory/imports"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-caption text-slate-400 transition duration-150 hover:bg-ink-800 hover:text-slate-100"
          >
            <History className="h-3.5 w-3.5" aria-hidden /> Past uploads
          </Link>
          <Button variant="secondary" size="sm" onClick={onExport} loading={exporting}>
            <Download className="h-4 w-4" aria-hidden /> Export CSV
          </Button>
          {isAdmin ? (
            <Button size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={panelOpen}>
              <Upload className="h-4 w-4" aria-hidden /> Import
            </Button>
          ) : null}
        </div>
      </div>

      {/* Kept mounted rather than rendered with the panel: it is the accessible name for the drop
          area, and a merchant may reach it by keyboard before opening anything. */}
      {isAdmin ? (
        <input
          ref={fileInput}
          id="bulk-upload-file"
          type="file"
          accept={ACCEPTED}
          aria-label="Excel or CSV file"
          disabled={isActive(job)}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setError(null);
          }}
          className="peer sr-only"
        />
      ) : (
        <p className="mt-3 rounded-lg border border-ink-700 bg-ink-850 p-2.5 text-caption text-slate-400">
          Uploading is restricted to administrators — one file can change every price in the catalogue. You can still
          export.
        </p>
      )}

      {isAdmin && panelOpen ? (
        <div className="mt-4">
          <label
            htmlFor="bulk-upload-file"
            onDrop={onDrop}
            className={[
              'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed px-4 py-6 text-center',
              'transition duration-200 ease-in-out peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40',
              dragging
                ? 'border-primary bg-primary/10'
                : 'border-ink-700 bg-ink-850 hover:border-ink-600 hover:bg-ink-800',
            ].join(' ')}
          >
            <UploadCloud
              className={`h-6 w-6 transition duration-200 ease-in-out ${
                dragging ? 'scale-110 text-primary' : 'text-slate-500'
              }`}
              aria-hidden
            />
            <span className="text-body-sm text-slate-200">
              {dragging ? 'Drop it here' : 'Drop your workbook here, or click to browse'}
            </span>
            <span className="text-caption text-slate-500">
              .xlsx keeps barcodes intact — a CSV export flattens them to 8.90123E+12
            </span>
          </label>

          {file ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2">
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-body-sm text-slate-200">{file.name}</span>
              <span className="shrink-0 text-caption tabular-nums text-slate-500">{fileSize(file.size)}</span>
              <button
                type="button"
                onClick={reset}
                disabled={isActive(job)}
                aria-label="Remove file"
                className="rounded-full p-1 text-slate-500 transition duration-150 hover:bg-ink-700 hover:text-slate-200 disabled:opacity-40"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ) : null}

          {error ? (
            <p className="mt-3 rounded-lg border border-danger-700/50 bg-danger-900/20 p-2.5 text-caption text-danger-200">
              {error}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-caption text-slate-400">
              <input
                type="checkbox"
                checked={dryRun}
                disabled={isActive(job)}
                onChange={(e) => setDryRun(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Check the file first, without changing anything
            </label>
            <Button onClick={() => onUpload(dryRun)} loading={busy} disabled={!file || isActive(job)}>
              <Upload className="h-4 w-4" aria-hidden /> {dryRun ? 'Check file' : 'Upload'}
            </Button>
          </div>
        </div>
      ) : null}

      {job ? <ImportReport job={job} onDismiss={reset} onApply={applyForReal} busy={busy} /> : null}

      {/* The things merchants get wrong, and the one export switch — a click away from the controls
          they belong to, rather than a permanent wall of small print. */}
      <button
        type="button"
        onClick={() => setTipsOpen((v) => !v)}
        aria-expanded={tipsOpen}
        className="mt-3 inline-flex items-center gap-1 text-caption text-slate-500 transition duration-150 hover:text-slate-300"
      >
        <ChevronDown
          className={`h-3.5 w-3.5 transition duration-200 ease-in-out ${tipsOpen ? 'rotate-180' : ''}`}
          aria-hidden
        />
        How it works &amp; export options
      </button>

      {tipsOpen ? (
        <div className="mt-2 rounded-lg border border-ink-700 bg-ink-850 p-3">
          <ul className="space-y-1.5 text-caption text-slate-500">
            <li className="flex gap-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                On an existing product, a <strong>blank cell leaves that field unchanged</strong> — importing cannot
                clear a field.
              </span>
            </li>
            <li className="flex gap-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                <strong>Send the .xlsx workbook itself.</strong> Saving as CSV rewrites a 13-digit barcode as{' '}
                <code>8.90123E+12</code> and the missing digits cannot be recovered.
              </span>
            </li>
            <li className="flex gap-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                If you do send a CSV, save it as <strong>CSV UTF-8</strong>, not plain CSV, or accented names and ₹
                signs arrive mangled.
              </span>
            </li>
            <li className="flex gap-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Exporting with no products gives just the header row, which works as a blank template.
            </li>
          </ul>

          {/* The mark is what makes Excel read UTF-8 correctly and what some phone spreadsheet apps
              render as junk in front of the sku heading. Neither is right everywhere, so it is a
              choice rather than a decision made for the merchant. */}
          <label className="mt-3 flex items-start gap-2 border-t border-ink-700 pt-3 text-caption text-slate-300">
            <input
              type="checkbox"
              checked={excelBom}
              onChange={(e) => setExcelBom(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span>
              Download for Excel on Windows
              <span className="block text-caption text-slate-500">
                Keeps accented names and ₹ readable there. Untick if the file opens with odd characters in front of
                &ldquo;sku&rdquo; — some phone spreadsheet apps do that.
              </span>
            </span>
          </label>
        </div>
      ) : null}
      </Card>
    </div>
  );
}

function ImportReport({
  job,
  onDismiss,
  onApply,
  busy,
}: {
  job: ProductImportJobResponse;
  onDismiss: () => void;
  onApply: () => void;
  busy: boolean;
}) {
  if (isActive(job)) {
    return (
      <div className="mt-3 rounded-lg border border-ink-700 bg-ink-850 p-3">
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
      <div className="mt-3 rounded-lg border border-danger-700/50 bg-danger-900/20 p-3">
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
    <div className="mt-3 rounded-lg border border-ink-700 bg-ink-850 p-3">
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
          Nothing was changed yet — apply it to add these products for real.
        </p>
      ) : null}

      {job.issues.length > 0 ? (
        <div className="mt-4">
          <ImportIssueTable job={job} />
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {job.dryRun ? (
          // Applies the file. This button used only to clear the form, so the control named as the
          // thing that imports was the one that threw the merchant's selection away.
          <Button size="sm" onClick={onApply} loading={busy}>
            <Upload className="h-4 w-4" aria-hidden /> Apply for real
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          {job.dryRun ? 'Choose another file' : 'Done'}
        </Button>
      </div>
    </div>
  );
}

/**
 * The per-row report, shared by the upload card and the history page.
 *
 * <p>The footnote about row numbers is not decoration: `line` counts spreadsheet rows so it matches
 * the gutter Excel shows, and a merchant who assumes it is a zero-based index goes and edits the
 * wrong product.
 */
export function ImportIssueTable({ job }: { job: ProductImportJobResponse }) {
  return (
    <>
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
      <p className="mt-2 text-caption text-slate-500">Row numbers match your spreadsheet — the header is row 1.</p>
    </>
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
