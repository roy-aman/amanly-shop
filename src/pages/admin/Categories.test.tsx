import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Categories from './Categories';
import { adminCategories } from '@/api/admin';
import type { CategoryResponse } from '@/lib/types';
import { renderWithProviders } from '@/test/utils';

vi.mock('@/api/admin', () => ({
  adminCategories: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), move: vi.fn() },
}));

const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), push: vi.fn() };
vi.mock('@/context/ToastContext', () => ({ useToast: () => toast }));
vi.mock('@/context/AuthContext', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useAuth: () => ({ isAdmin: true }),
}));

const listMock = vi.mocked(adminCategories.list);
const moveMock = vi.mocked(adminCategories.move);

function category(over: Partial<CategoryResponse> = {}): CategoryResponse {
  return {
    id: 'c1',
    name: 'Men',
    slug: 'men',
    description: null,
    parentId: null,
    parentName: null,
    depth: 0,
    sortOrder: 0,
    active: true,
    imageUrl: null,
    imageAltText: null,
    bannerUrl: null,
    createdAt: '2026-08-16T10:00:00Z',
    updatedAt: '2026-08-16T10:00:00Z',
    ...over,
  };
}

/** men > shirts > formal, plus an unrelated root. */
const TREE: CategoryResponse[] = [
  category({ id: 'men', name: 'Men', slug: 'men' }),
  category({ id: 'shirts', name: 'Shirts', slug: 'shirts', parentId: 'men', parentName: 'Men', depth: 1 }),
  category({ id: 'formal', name: 'Formal', slug: 'formal', parentId: 'shirts', parentName: 'Shirts', depth: 2 }),
  category({ id: 'sale', name: 'Sale', slug: 'sale' }),
];

beforeEach(() => {
  vi.clearAllMocks();
  listMock.mockResolvedValue(TREE);
  moveMock.mockResolvedValue(category({ id: 'shirts', name: 'Shirts', parentId: 'sale', parentName: 'Sale' }));
});

describe('Category tree — moving', () => {
  /**
   * Dragging is unreachable by keyboard and unreliable on touch, so the same move has to be
   * possible without it. This is the path most admins on a laptop trackpad will actually use.
   */
  it('moves a category to a new parent through the picker', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Categories />);
    await screen.findByText('Shirts');

    await user.click(screen.getByRole('button', { name: /move shirts/i }));
    const dialog = await screen.findByText(/everything inside shirts moves with it/i);
    await user.click(within(dialog.parentElement as HTMLElement).getByRole('button', { name: /^sale$/i }));

    await waitFor(() => expect(moveMock).toHaveBeenCalledWith('shirts', { parentId: 'sale' }));
  });

  it('promotes a category to the top level', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Categories />);
    await screen.findByText('Shirts');

    await user.click(screen.getByRole('button', { name: /move shirts/i }));
    await user.click(await screen.findByRole('button', { name: /^top level$/i }));

    await waitFor(() => expect(moveMock).toHaveBeenCalledWith('shirts', { parentId: null }));
  });

  /**
   * A branch moved inside its own subtree is detached from every root — the rows survive and
   * nothing reaches them. The backend refuses it; not offering the target is what makes that
   * felt as "not a destination" rather than as an error after the fact.
   */
  it('does not offer a category inside the one being moved', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Categories />);
    await screen.findByText('Shirts');

    await user.click(screen.getByRole('button', { name: /move shirts/i }));
    await screen.findByText(/everything inside shirts moves with it/i);

    // "Formal" sits inside "Shirts", so it must not be a destination.
    expect(screen.queryByRole('button', { name: /^formal$/i })).not.toBeInTheDocument();
    // A category outside the branch still is.
    expect(screen.getByRole('button', { name: /^sale$/i })).toBeInTheDocument();
  });

  it('marks the current parent as already holding it', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Categories />);
    await screen.findByText('Shirts');

    await user.click(screen.getByRole('button', { name: /move shirts/i }));

    expect(await screen.findByRole('button', { name: /men — already here/i })).toBeDisabled();
  });

  it('explains a cycle rejection in the tree’s own terms', async () => {
    const { ApiError } = await import('@/lib/http');
    moveMock.mockRejectedValue(new ApiError(400, 'CATEGORY_CYCLE', 'cycle'));
    const user = userEvent.setup();
    renderWithProviders(<Categories />);
    await screen.findByText('Shirts');

    await user.click(screen.getByRole('button', { name: /move shirts/i }));
    await user.click(await screen.findByRole('button', { name: /^sale$/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Cannot move it there', expect.stringMatching(/sits inside/i)),
    );
  });

  it('explains a depth rejection as being about the branch, not the row', async () => {
    const { ApiError } = await import('@/lib/http');
    moveMock.mockRejectedValue(new ApiError(400, 'CATEGORY_DEPTH_EXCEEDED', 'deep'));
    const user = userEvent.setup();
    renderWithProviders(<Categories />);
    await screen.findByText('Shirts');

    await user.click(screen.getByRole('button', { name: /move shirts/i }));
    await user.click(await screen.findByRole('button', { name: /^sale$/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Too deep', expect.stringMatching(/deepest category in that branch/i)),
    );
  });

  it('tells the merchant the rows can be dragged', async () => {
    renderWithProviders(<Categories />);

    expect(await screen.findByText(/drag a category onto another to nest it/i)).toBeInTheDocument();
  });
});
