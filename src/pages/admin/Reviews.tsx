import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, MessagesSquare, X } from 'lucide-react';
import { adminReviews } from '@/api/admin';
import { ApiError } from '@/lib/http';
import { formatDate } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import type { AdminReviewResponse, ReviewStatus } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  FilterChip,
  PageHeader,
  Pagination,
  RatingStars,
  type Column,
  type Tone,
} from '@/components/ui';

const PAGE_SIZE = 20;

const STATUS_TONE: Record<ReviewStatus, Tone> = { PENDING: 'amber', APPROVED: 'green', REJECTED: 'red' };
const STATUS_LABEL: Record<ReviewStatus, string> = { PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected' };

// Undefined = "All statuses". Default view is the PENDING moderation queue.
const FILTERS: { value: ReviewStatus | undefined; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: undefined, label: 'All' },
];

export default function Reviews() {
  const qc = useQueryClient();
  const toast = useToast();

  const [status, setStatus] = useState<ReviewStatus | undefined>('PENDING');
  const [page, setPage] = useState(0);
  const [rejectTarget, setRejectTarget] = useState<AdminReviewResponse | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'reviews', status ?? 'ALL', page],
    queryFn: () => adminReviews.list({ status, page, size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['admin', 'reviews'] });
  }

  function onError(e: unknown, title: string) {
    if (e instanceof ApiError) toast.error(title, e.message);
    else toast.error(title, 'An unexpected error occurred.');
  }

  const approveMutation = useMutation({
    mutationFn: (id: string) => adminReviews.approve(id),
    onSuccess: () => {
      invalidate();
      toast.success('Review approved', 'It is now visible on the storefront.');
    },
    onError: (e) => onError(e, 'Could not approve'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => adminReviews.reject(id),
    onSuccess: () => {
      invalidate();
      setRejectTarget(null);
      toast.success('Review rejected', 'It has been hidden from the storefront.');
    },
    onError: (e) => onError(e, 'Could not reject'),
  });

  function changeFilter(next: ReviewStatus | undefined) {
    setStatus(next);
    setPage(0);
  }

  const columns: Column<AdminReviewResponse>[] = [
    {
      key: 'reviewer',
      header: 'Reviewer',
      render: (r) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-100">{r.reviewerName}</span>
            {r.verifiedPurchase && <Badge tone="blue">Verified</Badge>}
          </div>
          <p className="truncate font-mono text-xs text-slate-500">Product {r.productId.slice(0, 8)}…</p>
        </div>
      ),
    },
    {
      key: 'rating',
      header: 'Rating',
      render: (r) => <RatingStars value={r.rating} size="sm" />,
    },
    {
      key: 'review',
      header: 'Review',
      className: 'max-w-md',
      render: (r) => (
        <div className="min-w-0">
          {r.title && <p className="truncate font-medium text-slate-200">{r.title}</p>}
          {r.body ? (
            <p className="line-clamp-2 text-body-sm text-slate-400">{r.body}</p>
          ) : (
            !r.title && <span className="text-slate-500">—</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>,
    },
    {
      key: 'createdAt',
      header: 'Submitted',
      render: (r) => <span className="whitespace-nowrap text-slate-400">{formatDate(r.createdAt)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader title="Reviews" subtitle="Moderate customer reviews before they appear on the storefront." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <FilterChip
            key={f.label}
            selected={status === f.value}
            onClick={() => changeFilter(f.value)}
          >
            {f.label}
          </FilterChip>
        ))}
      </div>

      <Card className="p-0">
        {isError ? (
          <EmptyState
            icon={<MessagesSquare className="h-10 w-10" />}
            title="Could not load reviews"
            message="Something went wrong fetching the moderation queue."
            action={<Button variant="outline" onClick={() => refetch()}>Retry</Button>}
          />
        ) : (
          <DataTable
            columns={columns}
            data={data?.content ?? []}
            getRowKey={(r) => r.id}
            loading={isLoading}
            loadingRows={6}
            empty={
              <EmptyState
                icon={<MessagesSquare className="h-10 w-10" />}
                title={status === 'PENDING' ? 'Queue is clear' : 'No reviews'}
                message={
                  status === 'PENDING'
                    ? 'There are no reviews waiting for moderation.'
                    : 'No reviews match this filter.'
                }
              />
            }
            rowActions={(r) => (
              <div className="flex justify-end gap-1">
                {r.status !== 'APPROVED' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => approveMutation.mutate(r.id)}
                    loading={approveMutation.isPending && approveMutation.variables === r.id}
                    aria-label={`Approve review by ${r.reviewerName}`}
                  >
                    <Check className="h-4 w-4 text-success-400" /> Approve
                  </Button>
                )}
                {r.status !== 'REJECTED' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRejectTarget(r)}
                    aria-label={`Reject review by ${r.reviewerName}`}
                  >
                    <X className="h-4 w-4 text-danger-400" /> Reject
                  </Button>
                )}
              </div>
            )}
          />
        )}
      </Card>

      {data && data.totalPages > 1 && (
        <div className="mt-4">
          <Pagination page={data.number} totalPages={data.totalPages} onChange={setPage} />
        </div>
      )}

      <ConfirmDialog
        open={rejectTarget != null}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        title="Reject this review?"
        description="It will be hidden from the storefront. You can approve it again later."
        confirmLabel="Reject review"
        destructive
        loading={rejectMutation.isPending}
        onConfirm={() => rejectTarget && rejectMutation.mutate(rejectTarget.id)}
      />
    </div>
  );
}
