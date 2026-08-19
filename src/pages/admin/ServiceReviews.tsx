import { adminServiceReviews } from '@/api/serviceReviews';
import { useBookingsEntitlement } from '@/lib/useBookingsGate';
import { Badge, EmptyState, type Column } from '@/components/ui';
import {
  ReviewModeration,
  type ModeratableReview,
  type ModerationAdapter,
} from '@/components/admin/ReviewModeration';

/**
 * The service moderation queue.
 *
 * The same screen the product queue uses; only the endpoints and one word
 * differ. On the wire a service review carries `verifiedBooking` where a product
 * one carries `verifiedPurchase` — both mean "this person actually had it", and
 * the queue is shown the normalised `verified`.
 */
type ServiceRow = ModeratableReview & { serviceOfferingId: string };

const adapter: ModerationAdapter = {
  list: (params) =>
    adminServiceReviews.list(params).then((page) => ({
      ...page,
      content: page.content.map<ServiceRow>((r) => ({ ...r, verified: r.verifiedBooking })),
    })),
  approve: (id) => adminServiceReviews.approve(id),
  reject: (id) => adminServiceReviews.reject(id),
};

const subjectColumn: Column<ModeratableReview> = {
  key: 'reviewer',
  header: 'Reviewer',
  render: (r) => (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span className="font-medium text-slate-100">{r.reviewerName}</span>
        {/* "Verified visit" rather than "Verified": on a service the claim being
            made is that they came in, which is the whole basis of the review. */}
        {r.verified && <Badge tone="blue">Verified visit</Badge>}
      </div>
      <p className="truncate font-mono text-xs text-slate-500">
        Service {(r as ServiceRow).serviceOfferingId.slice(0, 8)}…
      </p>
    </div>
  ),
};

export default function ServiceReviews() {
  const { bookingsAllowed, loading } = useBookingsEntitlement();

  if (loading) return null;
  if (!bookingsAllowed) {
    return (
      <EmptyState
        title="Bookings aren’t part of this store’s plan"
        message="Get in touch with us and we can switch appointments on for you."
      />
    );
  }

  return (
    <ReviewModeration
      title="Service reviews"
      subtitle="Moderate what customers say about your services before it appears."
      adapter={adapter}
      queryKeyRoot={['admin', 'service-reviews']}
      subjectColumn={subjectColumn}
    />
  );
}
