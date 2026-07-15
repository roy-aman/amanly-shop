import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import Reviews from './Reviews';
import { adminReviews } from '@/api/admin';
import type { AdminReviewResponse, Page } from '@/lib/types';

vi.mock('@/api/admin', () => ({
  adminReviews: { list: vi.fn(), approve: vi.fn(), reject: vi.fn() },
}));
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), push: vi.fn() }),
}));

const listMock = vi.mocked(adminReviews.list);
const approveMock = vi.mocked(adminReviews.approve);
const rejectMock = vi.mocked(adminReviews.reject);

function pending(overrides: Partial<AdminReviewResponse> = {}): AdminReviewResponse {
  return {
    id: 'rev-1',
    productId: '11111111-2222-3333-4444-555555555555',
    userId: 'u1',
    reviewerName: 'Grace H.',
    rating: 5,
    title: 'Excellent',
    body: 'Would buy again.',
    status: 'PENDING',
    verifiedPurchase: true,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    ...overrides,
  };
}

function page(content: AdminReviewResponse[]): Page<AdminReviewResponse> {
  return {
    content,
    totalElements: content.length,
    totalPages: 1,
    number: 0,
    size: 20,
    first: true,
    last: true,
    numberOfElements: content.length,
    empty: content.length === 0,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  listMock.mockResolvedValue(page([pending()]));
  approveMock.mockResolvedValue(pending({ status: 'APPROVED' }));
  rejectMock.mockResolvedValue(pending({ status: 'REJECTED' }));
});

describe('Admin Reviews moderation', () => {
  it('defaults to the PENDING queue and lists reviews', async () => {
    renderWithProviders(<Reviews />);
    expect(await screen.findByText('Grace H.')).toBeInTheDocument();
    expect(listMock).toHaveBeenCalledWith({ status: 'PENDING', page: 0, size: 20 });
  });

  it('calls the approve endpoint when Approve is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Reviews />);

    const approveBtn = await screen.findByRole('button', { name: /approve review by grace h\./i });
    await user.click(approveBtn);

    expect(approveMock).toHaveBeenCalledWith('rev-1');
  });

  it('shows an empty state when the queue is clear', async () => {
    listMock.mockResolvedValue(page([]));
    renderWithProviders(<Reviews />);
    expect(await screen.findByText('Queue is clear')).toBeInTheDocument();
  });
});
