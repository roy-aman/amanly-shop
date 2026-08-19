import { adminReviews } from '@/api/admin';
import { Badge, type Column } from '@/components/ui';
import {
  ReviewModeration,
  type ModeratableReview,
  type ModerationAdapter,
} from '@/components/admin/ReviewModeration';

/**
 * The product moderation queue.
 *
 * The queue itself lives in {@link ReviewModeration}, which serves products and
 * services alike — the endpoints are the same shape and the decision is the same
 * decision. What is left here is the endpoints, the word "purchase", and the
 * column naming which product a review is about.
 *
 * Rendering is unchanged by that split; this page produces the DOM it always did.
 */
type ProductRow = ModeratableReview & { productId: string };

const adapter: ModerationAdapter = {
  list: (params) =>
    adminReviews.list(params).then((page) => ({
      ...page,
      // `verifiedPurchase` is this API's word for it; the queue knows only `verified`.
      content: page.content.map<ProductRow>((r) => ({ ...r, verified: r.verifiedPurchase })),
    })),
  approve: (id) => adminReviews.approve(id),
  reject: (id) => adminReviews.reject(id),
};

const subjectColumn: Column<ModeratableReview> = {
  key: 'reviewer',
  header: 'Reviewer',
  render: (r) => (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span className="font-medium text-slate-100">{r.reviewerName}</span>
        {r.verified && <Badge tone="blue">Verified</Badge>}
      </div>
      <p className="truncate font-mono text-xs text-slate-500">
        Product {(r as ProductRow).productId.slice(0, 8)}…
      </p>
    </div>
  ),
};

export default function Reviews() {
  return (
    <ReviewModeration
      title="Reviews"
      subtitle="Moderate customer reviews before they appear on the storefront."
      adapter={adapter}
      queryKeyRoot={['admin', 'reviews']}
      subjectColumn={subjectColumn}
    />
  );
}
