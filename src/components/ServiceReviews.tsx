import {
  createServiceReview,
  getMyServiceReview,
  getServiceReviewSummary,
  listServiceReviews,
  updateMyServiceReview,
} from '@/api/serviceReviews';
import { useAuth } from '@/context/AuthContext';
import ReviewsSection, { type ReviewsAdapter, type ReviewsCopy } from '@/components/ReviewsSection';

/**
 * Reviews of a service.
 *
 * The same screen as the product one, because the API is the same shape by
 * design. What differs is who has earned a say: a completed appointment rather
 * than a delivered order, which the backend calls `booked` and refuses with
 * REVIEW_NOT_BOOKED.
 *
 * The wording follows from that. Someone reading a service review wants to know
 * the reviewer actually came in, so the badge says "Verified visit" — "verified
 * purchase" would be a strange claim about something nobody bought a box of.
 */
const adapter: ReviewsAdapter = {
  summary: (serviceId) => getServiceReviewSummary(serviceId),
  list: (serviceId, params) => listServiceReviews(serviceId, params),
  mine: (serviceId) => getMyServiceReview(serviceId).then((r) => ({ ...r, eligible: r.booked })),
  create: (serviceId, body) => createServiceReview(serviceId, body),
  update: (serviceId, body) => updateMyServiceReview(serviceId, body),
};

const copy: ReviewsCopy = {
  // Its own key root: a service and a product could share an id space one day,
  // and two caches under one key would serve one's reviews for the other.
  queryKeyRoot: 'service-reviews',
  notEligibleCode: 'REVIEW_NOT_BOOKED',
  verifiedLabel: 'Verified visit',
  signedOutPrompt: 'Been in for this? Sign in to share how it went.',
  signedOutCta: 'Sign in to review',
  eligiblePrompt: 'You have had this done — tell others how it went.',
  notEligibleNote:
    'Reviews come from people who have been in — you can write one after your appointment is complete.',
  notEligibleToast: {
    title: 'Appointment required',
    message: 'You can review this once you have had a completed appointment.',
  },
  emptyTitle: 'No reviews yet',
  emptyMessage: 'Be the first to share how this went.',
  placeholderTitle: 'Sum it up in a few words',
  placeholderBody: 'How was the service? Would you come back?',
};

export default function ServiceReviews({ serviceId }: { serviceId: string }) {
  const { isAuthenticated } = useAuth();
  return <ReviewsSection subjectId={serviceId} isAuthenticated={isAuthenticated} adapter={adapter} copy={copy} />;
}
