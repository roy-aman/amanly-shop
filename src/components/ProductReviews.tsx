import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, MessageSquarePlus, PencilLine, Star } from 'lucide-react';
import { createReview, getMyReview, getReviewSummary, listReviews, updateMyReview } from '@/api/reviews';
import { ApiError } from '@/lib/http';
import { formatDate } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import type { MyReview, ReviewStatus } from '@/lib/types';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Modal,
  Pagination,
  RatingInput,
  RatingStars,
  SkeletonText,
  Textarea,
  Input,
  type Tone,
} from '@/components/ui';

const PAGE_SIZE = 5;
const TITLE_MAX = 150;
const BODY_MAX = 4000;

const STATUS_TONE: Record<ReviewStatus, Tone> = { PENDING: 'amber', APPROVED: 'green', REJECTED: 'red' };
const STATUS_LABEL: Record<ReviewStatus, string> = {
  PENDING: 'Pending approval',
  APPROVED: 'Published',
  REJECTED: 'Not approved',
};

/**
 * PDP reviews tab: rating summary + histogram, paginated approved-review list,
 * and the write/edit-review flow. Eligibility is driven by `/reviews/mine`
 * (`canReview` / `purchased` / existing `review`) so unauthenticated, non-buyer,
 * and already-reviewed users each see the right affordance. Mounted only when the
 * Reviews tab is active, so its network calls don't fire on page load.
 */
export default function ProductReviews({
  productId,
  isAuthenticated,
}: {
  productId: string;
  isAuthenticated: boolean;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);

  const summaryQuery = useQuery({
    queryKey: ['reviews', productId, 'summary'],
    queryFn: () => getReviewSummary(productId),
  });
  const listQuery = useQuery({
    queryKey: ['reviews', productId, 'list', page],
    queryFn: () => listReviews(productId, { page, size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const mineQuery = useQuery({
    queryKey: ['reviews', productId, 'mine'],
    queryFn: () => getMyReview(productId),
    enabled: isAuthenticated,
  });

  const summary = summaryQuery.data;
  const list = listQuery.data;
  const mine = mineQuery.data;
  const existing = mine?.review ?? null;

  function invalidateReviews() {
    qc.invalidateQueries({ queryKey: ['reviews', productId] });
  }

  const submitMutation = useMutation({
    mutationFn: (body: { rating: number; title: string | null; body: string | null }) =>
      existing ? updateMyReview(productId, body) : createReview(productId, body),
    onSuccess: () => {
      invalidateReviews();
      toast.success(existing ? 'Review updated' : 'Review submitted', 'It will appear once approved by our team.');
      setDialogOpen(false);
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        // Concurrent state drift — someone/something already created a review; resync.
        if (e.code === 'REVIEW_ALREADY_EXISTS') {
          qc.invalidateQueries({ queryKey: ['reviews', productId, 'mine'] });
          setDialogOpen(false);
          toast.error('Already reviewed', e.message);
          return;
        }
        if (e.code === 'REVIEW_NOT_PURCHASED') {
          toast.error('Purchase required', 'Only verified buyers can review this product.');
          return;
        }
        toast.error('Could not submit review', e.message);
      } else {
        toast.error('Could not submit review', 'Please try again.');
      }
    },
  });

  const average = summary?.average ?? null;
  const count = summary?.count ?? 0;

  return (
    <div className="space-y-8">
      {/* ── Summary + eligibility CTA ─────────────────────────────────── */}
      <div className="grid gap-6 rounded-2xl border border-ink-800 bg-ink-900/50 p-6 md:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center justify-center border-ink-800 pr-0 text-center md:border-r md:pr-8">
          {summaryQuery.isLoading ? (
            <SkeletonText lines={2} />
          ) : count > 0 && average != null ? (
            <>
              <span className="text-4xl font-bold text-slate-50">{average.toFixed(1)}</span>
              <RatingStars value={average} size="md" className="mt-1.5" />
              <span className="mt-1 text-caption text-slate-400">
                {count} {count === 1 ? 'review' : 'reviews'}
              </span>
            </>
          ) : (
            <div className="flex flex-col items-center text-slate-500">
              <Star className="h-8 w-8" />
              <span className="mt-2 text-body-sm">No ratings yet</span>
            </div>
          )}
        </div>

        <div className="flex flex-col justify-between gap-4">
          {/* Star histogram (5 → 1) */}
          <div className="space-y-1.5" aria-hidden={count === 0}>
            {[5, 4, 3, 2, 1].map((star) => {
              const n = summary?.buckets?.[String(star)] ?? 0;
              const pct = count > 0 ? (n / count) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-3 text-caption text-slate-400">
                  <span className="w-10 shrink-0 tabular-nums">{star} star</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-800">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-8 shrink-0 text-right tabular-nums">{n}</span>
                </div>
              );
            })}
          </div>

          <div className="border-t border-ink-800 pt-4">{renderCta()}</div>
        </div>
      </div>

      {/* ── Review list ───────────────────────────────────────────────── */}
      {listQuery.isLoading ? (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonText key={i} lines={3} />
          ))}
        </div>
      ) : listQuery.isError ? (
        <EmptyState
          icon={<Star className="h-10 w-10" />}
          title="Could not load reviews"
          message="Please try again shortly."
        />
      ) : !list || list.content.length === 0 ? (
        <EmptyState
          icon={<Star className="h-10 w-10" />}
          title="No reviews yet"
          message="Be the first to share your experience with this product."
        />
      ) : (
        <>
          <ul className="divide-y divide-ink-800">
            {list.content.map((r) => (
              <li key={r.id} className="py-5 first:pt-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <RatingStars value={r.rating} size="sm" />
                  {r.title && <span className="font-semibold text-slate-100">{r.title}</span>}
                  {r.verifiedPurchase && (
                    <span className="inline-flex items-center gap-1 text-caption text-success-300">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Verified purchase
                    </span>
                  )}
                </div>
                {r.body && <p className="mt-2 whitespace-pre-line text-body-sm text-slate-300">{r.body}</p>}
                <p className="mt-2 text-caption text-slate-500">
                  {r.reviewerName} · {formatDate(r.createdAt)}
                </p>
              </li>
            ))}
          </ul>
          <Pagination page={list.number} totalPages={list.totalPages} onChange={setPage} />
        </>
      )}

      {dialogOpen && (
        <ReviewDialog
          existing={existing}
          submitting={submitMutation.isPending}
          onClose={() => setDialogOpen(false)}
          onSubmit={(body) => submitMutation.mutate(body)}
        />
      )}
    </div>
  );

  // ── Eligibility-driven call to action ────────────────────────────────
  function renderCta() {
    if (!isAuthenticated) {
      return (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-body-sm text-slate-300">Purchased this product? Sign in to share your review.</p>
          <Button
            variant="outline"
            onClick={() => navigate('/login', { state: { from: location.pathname + location.search } })}
          >
            Sign in to review
          </Button>
        </div>
      );
    }

    if (mineQuery.isLoading) return <SkeletonText lines={1} />;

    if (existing) {
      return (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-body-sm font-medium text-slate-200">Your review</span>
              <Badge tone={STATUS_TONE[existing.status]}>{STATUS_LABEL[existing.status]}</Badge>
            </div>
            <RatingStars value={existing.rating} size="sm" className="mt-1.5" />
          </div>
          <Button variant="outline" onClick={() => setDialogOpen(true)}>
            <PencilLine className="h-4 w-4" /> Edit review
          </Button>
        </div>
      );
    }

    if (mine?.canReview) {
      return (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-body-sm text-slate-300">You bought this — tell others what you think.</p>
          <Button onClick={() => setDialogOpen(true)}>
            <MessageSquarePlus className="h-4 w-4" /> Write a review
          </Button>
        </div>
      );
    }

    // Authenticated, not a verified buyer, no review.
    return <p className="text-caption text-slate-500">Only verified buyers can review this product.</p>;
  }
}

// ── Write / edit review dialog ─────────────────────────────────────────
function ReviewDialog({
  existing,
  submitting,
  onClose,
  onSubmit,
}: {
  existing: MyReview | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (body: { rating: number; title: string | null; body: string | null }) => void;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [ratingError, setRatingError] = useState<string | null>(null);

  const editing = existing != null;
  const titleTooLong = title.length > TITLE_MAX;
  const bodyTooLong = body.length > BODY_MAX;

  function handleSubmit() {
    if (rating < 1 || rating > 5) {
      setRatingError('Please choose a star rating.');
      return;
    }
    if (titleTooLong || bodyTooLong) return;
    onSubmit({ rating, title: title.trim() || null, body: body.trim() || null });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Edit your review' : 'Write a review'}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            {editing ? 'Save changes' : 'Submit review'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {editing && (
          <p className="rounded-lg border border-ink-800 bg-ink-850/60 px-3 py-2 text-caption text-slate-400">
            Editing resets your review to pending re-approval.
          </p>
        )}
        <Field label="Your rating" required error={ratingError ?? undefined}>
          <RatingInput
            value={rating}
            onChange={(v) => {
              setRating(v);
              setRatingError(null);
            }}
          />
        </Field>
        <Field
          label="Title"
          hint={`Optional · ${title.length}/${TITLE_MAX}`}
          error={titleTooLong ? `Keep the title under ${TITLE_MAX} characters.` : undefined}
        >
          <Input
            value={title}
            maxLength={TITLE_MAX + 20}
            invalid={titleTooLong}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sum it up in a few words"
          />
        </Field>
        <Field
          label="Review"
          hint={`Optional · ${body.length}/${BODY_MAX}`}
          error={bodyTooLong ? `Keep your review under ${BODY_MAX} characters.` : undefined}
        >
          <Textarea
            rows={4}
            value={body}
            invalid={bodyTooLong}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What did you like or dislike? How was the quality?"
          />
        </Field>
      </div>
    </Modal>
  );
}
