import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import ProductReviews from './ProductReviews';
import { getMyReview, getReviewSummary, listReviews } from '@/api/reviews';
import type { MyReviewResponse, Page, ReviewResponse, ReviewSummaryResponse } from '@/lib/types';

vi.mock('@/api/reviews', () => ({
  getReviewSummary: vi.fn(),
  listReviews: vi.fn(),
  getMyReview: vi.fn(),
  createReview: vi.fn(),
  updateMyReview: vi.fn(),
}));
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), push: vi.fn() }),
}));

const summaryMock = vi.mocked(getReviewSummary);
const listMock = vi.mocked(listReviews);
const mineMock = vi.mocked(getMyReview);

function summary(): ReviewSummaryResponse {
  return { average: 4.5, count: 2, buckets: { '1': 0, '2': 0, '3': 0, '4': 1, '5': 1 } };
}

function review(overrides: Partial<ReviewResponse> = {}): ReviewResponse {
  return {
    id: 'r1',
    rating: 5,
    title: 'Superb craftsmanship',
    body: 'Arrived quickly and feels premium.',
    reviewerName: 'Ada L.',
    verifiedPurchase: true,
    createdAt: '2026-05-01T00:00:00Z',
    ...overrides,
  };
}

function listPage(content: ReviewResponse[]): Page<ReviewResponse> {
  return {
    content,
    totalElements: content.length,
    totalPages: 1,
    number: 0,
    size: 5,
    first: true,
    last: true,
    numberOfElements: content.length,
    empty: content.length === 0,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  summaryMock.mockResolvedValue(summary());
  listMock.mockResolvedValue(listPage([review()]));
  mineMock.mockResolvedValue({ purchased: false, canReview: false, review: null });
});

describe('ProductReviews (PDP tab)', () => {
  it('renders the summary average and the approved review list from the endpoints', async () => {
    renderWithProviders(<ProductReviews productId="p1" isAuthenticated={false} />);

    expect(await screen.findByText('4.5')).toBeInTheDocument();
    expect(screen.getByText('2 reviews')).toBeInTheDocument();
    // A review from the list is rendered.
    expect(await screen.findByText('Superb craftsmanship')).toBeInTheDocument();
    expect(screen.getByText(/Ada L\./)).toBeInTheDocument();
    expect(screen.getByText('Verified purchase')).toBeInTheDocument();
  });

  it('prompts unauthenticated users to sign in and shows no write-review button', async () => {
    renderWithProviders(<ProductReviews productId="p1" isAuthenticated={false} />);

    expect(await screen.findByRole('button', { name: /sign in to review/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /write a review/i })).not.toBeInTheDocument();
  });

  it('shows the write-review dialog only when canReview is true', async () => {
    mineMock.mockResolvedValue({ purchased: true, canReview: true, review: null });
    const user = userEvent.setup();
    renderWithProviders(<ProductReviews productId="p1" isAuthenticated={true} />);

    const writeBtn = await screen.findByRole('button', { name: /write a review/i });
    await user.click(writeBtn);

    expect(await screen.findByRole('heading', { name: 'Write a review' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit review/i })).toBeInTheDocument();
  });

  it('hides the CTA and notes verified-buyer-only when the user has not purchased', async () => {
    mineMock.mockResolvedValue({ purchased: false, canReview: false, review: null });
    renderWithProviders(<ProductReviews productId="p1" isAuthenticated={true} />);

    expect(await screen.findByText(/only verified buyers can review/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /write a review/i })).not.toBeInTheDocument();
  });

  it('shows an existing review with its moderation status and an edit affordance', async () => {
    const mine: MyReviewResponse = {
      purchased: true,
      canReview: false,
      review: {
        id: 'mine-1',
        rating: 4,
        title: 'Good',
        body: 'Solid.',
        status: 'PENDING',
        verifiedPurchase: true,
        createdAt: '2026-05-02T00:00:00Z',
        updatedAt: '2026-05-02T00:00:00Z',
      },
    };
    mineMock.mockResolvedValue(mine);
    renderWithProviders(<ProductReviews productId="p1" isAuthenticated={true} />);

    expect(await screen.findByText('Your review')).toBeInTheDocument();
    expect(screen.getByText('Pending approval')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit review/i })).toBeInTheDocument();
  });
});
