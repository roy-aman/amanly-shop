import { createReview, getMyReview, getReviewSummary, listReviews, updateMyReview } from '@/api/reviews';
import ReviewsSection, { type ReviewsAdapter, type ReviewsCopy } from '@/components/ReviewsSection';

/**
 * PDP reviews tab.
 *
 * The screen itself now lives in {@link ReviewsSection}, which serves products
 * and services alike — the review API is deliberately identical for both, and
 * two copies of a moderation-aware write flow would inevitably drift. What is
 * left here is what makes these *product* reviews: the endpoints, the word
 * "purchase", and the rule that a delivered order is what earns you a say.
 *
 * Rendering is unchanged by that split — the DOM this produces is the one it
 * always produced.
 */
const adapter: ReviewsAdapter = {
  summary: (productId) => getReviewSummary(productId),
  list: (productId, params) => listReviews(productId, params),
  // `purchased` is this API's word for "you have earned a review"; the section
  // below knows it only as `eligible`.
  mine: (productId) => getMyReview(productId).then((r) => ({ ...r, eligible: r.purchased })),
  create: (productId, body) => createReview(productId, body),
  update: (productId, body) => updateMyReview(productId, body),
};

const copy: ReviewsCopy = {
  queryKeyRoot: 'reviews',
  notEligibleCode: 'REVIEW_NOT_PURCHASED',
  verifiedLabel: 'Verified purchase',
  signedOutPrompt: 'Purchased this product? Sign in to share your review.',
  signedOutCta: 'Sign in to review',
  eligiblePrompt: 'You bought this — tell others what you think.',
  notEligibleNote:
    'Reviews come from people who bought the item — you can write one once your order has been delivered.',
  notEligibleToast: { title: 'Purchase required', message: 'Only verified buyers can review this product.' },
  emptyTitle: 'No reviews yet',
  emptyMessage: 'Be the first to share your experience with this product.',
  placeholderTitle: 'Sum it up in a few words',
  placeholderBody: 'What did you like or dislike? How was the quality?',
};

export default function ProductReviews({
  productId,
  isAuthenticated,
}: {
  productId: string;
  isAuthenticated: boolean;
}) {
  return <ReviewsSection subjectId={productId} isAuthenticated={isAuthenticated} adapter={adapter} copy={copy} />;
}
