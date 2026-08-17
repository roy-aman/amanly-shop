import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Bell, BellOff, Check, ChevronDown, Clock, RotateCcw, Trash2 } from 'lucide-react';
import { platformErrors, platformStores } from '@/api/platform';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { formatDate } from '@/lib/format';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  PageHeader,
  PageLoader,
  Select,
} from '@/components/ui';
import type { ErrorEventResponse, ErrorSource } from '@/lib/types';

/** Background failures have no request to describe, so the source is the only clue about where to
 *  look — worth showing rather than leaving the row half empty. */
const SOURCE_TONE: Record<ErrorSource, Parameters<typeof Badge>[0]['tone']> = {
  HTTP: 'gray',
  SCHEDULED: 'amber',
  ASYNC: 'amber',
  EMAIL: 'amber',
  // Green because nothing is broken: a store asking for more than its plan allows is a
  // sales lead sitting in the failures table, not an incident.
  PLAN_LIMIT: 'green',
  // Amber, not red: the API answered correctly. Something is still misconfigured and only the
  // operator can fix it, which is more than PLAN_LIMIT's "no action needed" green implies.
  STORE_NOT_MAPPED: 'amber',
};

const SOURCE_HELP: Record<ErrorSource, string> = {
  HTTP: 'A request that ended in a 500.',
  SCHEDULED: 'A scheduled sweep threw. Nobody is waiting on these, so they fail silently.',
  ASYNC: 'Background work threw after the request had already returned.',
  EMAIL: 'Outbound email could not be delivered — someone is waiting for a link that never arrived.',
  PLAN_LIMIT:
    'Not a fault: a store was refused because of its plan — a capability it has not been granted, or a quota it has spent. Grouped per store, so the count is how often that store has been blocked.',
  STORE_NOT_MAPPED:
    'A request arrived for an address no store has registered, and was refused. Attach the address shown to its store to fix it. Grouped per address rather than per URL, and recorded at most once a minute, so the count is minutes in which it happened — not requests.',
};

export default function PlatformErrors() {
  useDocumentTitle('Errors');
  const qc = useQueryClient();
  const toast = useToast();

  const [storeId, setStoreId] = useState('');
  const [openOnly, setOpenOnly] = useState(true);
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ErrorEventResponse | null>(null);

  const storesQuery = useQuery({ queryKey: ['platform-stores'], queryFn: () => platformStores.list() });

  const errorsQuery = useQuery({
    queryKey: ['platform-errors', storeId, openOnly, page],
    queryFn: () => platformErrors.list({ storeId: storeId || undefined, openOnly, page, size: 20 }),
  });

  const events = errorsQuery.data?.content ?? [];
  const totalPages = errorsQuery.data?.totalPages ?? 0;
  const refresh = () => qc.invalidateQueries({ queryKey: ['platform-errors'] });

  const resolveMutation = useMutation({
    mutationFn: ({ id, resolved }: { id: string; resolved: boolean }) => platformErrors.setResolved(id, resolved),
    onSuccess: async (detail) => {
      await refresh();
      toast.success(detail.summary.resolved ? 'Marked resolved' : 'Reopened');
    },
    onError: (e) => toast.error('Could not update', e instanceof Error ? e.message : 'Please try again.'),
  });

  const muteMutation = useMutation({
    mutationFn: ({ id, muted }: { id: string; muted: boolean }) => platformErrors.setMuted(id, muted),
    onSuccess: async (detail) => {
      await refresh();
      toast.success(
        detail.summary.muted ? 'Muted' : 'Unmuted',
        detail.summary.muted
          ? 'This failure will stop being recorded. A recurrence will not bring it back.'
          : 'Recording has resumed for this failure.',
      );
    },
    onError: (e) => toast.error('Could not update', e instanceof Error ? e.message : 'Please try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => platformErrors.remove(id),
    onSuccess: async () => {
      await refresh();
      setPendingDelete(null);
      toast.success('Deleted');
    },
    onError: (e) => {
      setPendingDelete(null);
      toast.error('Could not delete', e instanceof Error ? e.message : 'Please try again.');
    },
  });

  if (errorsQuery.isLoading) return <PageLoader />;

  return (
    <>
      <PageHeader
        title="Errors"
        subtitle="Things that broke — 500s, background jobs that threw, and email that failed to send"
      />

      <Card className="mb-6 flex flex-wrap items-end gap-4 p-4">
        <Field label="Store" className="min-w-[14rem]">
          <Select
            aria-label="Filter by store"
            value={storeId}
            onChange={(e) => {
              setStoreId(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All stores</option>
            {(storesQuery.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex items-center gap-2 pb-2 text-body-sm text-slate-300">
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(e) => {
              setOpenOnly(e.target.checked);
              setPage(0);
            }}
            className="h-4 w-4 rounded border-ink-600 bg-ink-850"
          />
          Open only
          <span className="text-caption text-slate-500">(hides resolved and muted)</span>
        </label>
      </Card>

      {events.length === 0 ? (
        <EmptyState
          title={openOnly ? 'Nothing broken' : 'Nothing recorded'}
          message="Rejected requests — wrong passwords, forbidden actions, validation failures — are never recorded here, so an empty list means nothing has actually failed."
        />
      ) : (
        <Card className="divide-y divide-ink-800 p-0">
          {events.map((e) => (
            <ErrorRow
              key={e.id}
              event={e}
              expanded={expanded === e.id}
              onToggle={() => setExpanded(expanded === e.id ? null : e.id)}
              onSetResolved={(resolved) => resolveMutation.mutate({ id: e.id, resolved })}
              onSetMuted={(muted) => muteMutation.mutate({ id: e.id, muted })}
              onDelete={() => setPendingDelete(e)}
              busy={resolveMutation.isPending || muteMutation.isPending}
            />
          ))}
        </Card>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        destructive
        title={`Delete ${pendingDelete?.reference ?? ''}?`}
        description={
          pendingDelete?.muted
            ? 'This issue is muted, and the mute is stored on the row — deleting it starts recording this failure again from scratch. Leave it muted instead if you want it to stay quiet.'
            : 'The record and its stack trace are removed. If the failure happens again it will be recorded as a new issue.'
        }
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
      />

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-caption text-slate-500">
            Page {page + 1} of {totalPages}
          </span>
          <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </>
  );
}

function ErrorRow({
  event,
  expanded,
  onToggle,
  onSetResolved,
  onSetMuted,
  onDelete,
  busy,
}: {
  event: ErrorEventResponse;
  expanded: boolean;
  onToggle: () => void;
  onSetResolved: (resolved: boolean) => void;
  onSetMuted: (muted: boolean) => void;
  onDelete: () => void;
  busy: boolean;
}) {
  // The stack trace is fetched only when a row is opened: it is by far the largest column and most
  // rows are never expanded.
  const detailQuery = useQuery({
    queryKey: ['platform-error', event.id],
    queryFn: () => platformErrors.get(event.id),
    enabled: expanded,
  });

  const shortClass = event.exceptionClass.slice(event.exceptionClass.lastIndexOf('.') + 1);

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-start gap-3">
        <AlertTriangle
          className={`mt-0.5 h-4 w-4 shrink-0 ${event.resolved ? 'text-slate-600' : 'text-danger-400'}`}
          aria-hidden
        />
        <button onClick={onToggle} className="min-w-0 flex-1 text-left" aria-expanded={expanded}>
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-body-sm font-medium text-slate-100">{shortClass}</span>
            <span title={SOURCE_HELP[event.source]}>
              <Badge tone={SOURCE_TONE[event.source]}>{event.source}</Badge>
            </span>
            {event.occurrences > 1 && <Badge tone="amber">×{event.occurrences}</Badge>}
            {event.resolved && <Badge tone="green">Resolved</Badge>}
            {event.muted && (
              <span title="No longer being recorded">
                <Badge tone="gray">Muted</Badge>
              </span>
            )}
          </p>
          <p className="mt-1 truncate text-caption text-slate-400">
            {event.httpMethod ? `${event.httpMethod} ${event.path}` : event.path}
          </p>
          {event.message && <p className="mt-1 line-clamp-2 text-caption text-slate-500">{event.message}</p>}
          <p className="mt-1 flex flex-wrap items-center gap-3 text-caption text-slate-600">
            <span className="font-mono">{event.reference}</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden /> {formatDate(event.lastSeenAt)}
            </span>
            {event.occurrences > 1 && <span>first seen {formatDate(event.firstSeenAt)}</span>}
          </p>
        </button>

        <Button
          variant="ghost"
          size="sm"
          loading={busy}
          onClick={() => onSetResolved(!event.resolved)}
          title={event.resolved ? 'Reopen' : 'Mark resolved — a recurrence will reopen it'}
          aria-label={event.resolved ? `Reopen ${event.reference}` : `Resolve ${event.reference}`}
        >
          {event.resolved ? <RotateCcw className="h-4 w-4" /> : <Check className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          loading={busy}
          onClick={() => onSetMuted(!event.muted)}
          title={
            event.muted
              ? 'Unmute — start recording this failure again'
              : 'Mute — stop recording this failure entirely. A recurrence will NOT unmute it.'
          }
          aria-label={event.muted ? `Unmute ${event.reference}` : `Mute ${event.reference}`}
        >
          {event.muted ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          title="Delete this record"
          aria-label={`Delete ${event.reference}`}
        >
          <Trash2 className="h-4 w-4 text-danger-300" />
        </Button>
        <ChevronDown
          className={`mt-1 h-4 w-4 shrink-0 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 border-t border-ink-800 pt-4">
          {detailQuery.isLoading ? (
            <p className="text-caption text-slate-500">Loading…</p>
          ) : (
            <>
              {detailQuery.data?.queryString && (
                <div>
                  <p className="text-caption text-slate-500">Query</p>
                  <p className="mt-1 break-all font-mono text-caption text-slate-300">
                    {detailQuery.data.queryString}
                  </p>
                </div>
              )}
              <div>
                <p className="text-caption text-slate-500">Stack trace</p>
                <pre className="mt-1 max-h-80 overflow-auto rounded-lg border border-ink-700 bg-ink-900 p-3 font-mono text-caption leading-relaxed text-slate-400">
                  {detailQuery.data?.stackTrace ?? '—'}
                </pre>
              </div>
              <p className="text-caption text-slate-600">
                Request bodies and headers are never recorded — they carry passwords and bearer tokens.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
