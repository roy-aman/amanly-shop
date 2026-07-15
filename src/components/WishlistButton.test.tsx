import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import WishlistButton from './WishlistButton';
import { WishlistProvider } from '@/context/WishlistContext';
import { addToWishlist, getWishlistIds, removeFromWishlist } from '@/api/wishlist';

// Auth is toggled per test; the provider reads it to gate/skip network calls.
let authed = true;
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: authed }) }));

const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), push: vi.fn() };
vi.mock('@/context/ToastContext', () => ({ useToast: () => toast }));

vi.mock('@/api/wishlist', () => ({
  getWishlist: vi.fn(),
  getWishlistIds: vi.fn(),
  addToWishlist: vi.fn(),
  removeFromWishlist: vi.fn(),
}));

const idsMock = vi.mocked(getWishlistIds);
const addMock = vi.mocked(addToWishlist);
const removeMock = vi.mocked(removeFromWishlist);

function renderButton() {
  return render(
    <MemoryRouter initialEntries={['/products/ring']}>
      <WishlistProvider>
        <Routes>
          <Route path="/products/ring" element={<WishlistButton productId="p1" productName="Ring" />} />
          <Route path="/login" element={<div>login page</div>} />
        </Routes>
      </WishlistProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  authed = true;
  idsMock.mockResolvedValue([]);
  addMock.mockResolvedValue({ productId: 'p1', wishlisted: true, wishlistCount: 1 });
  removeMock.mockResolvedValue({ productId: 'p1', wishlisted: false, wishlistCount: 0 });
});

describe('WishlistButton (WP-3.3b)', () => {
  it('optimistically adds to the wishlist and calls the API', async () => {
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole('button', { name: /add ring to wishlist/i }));

    await waitFor(() => expect(addMock).toHaveBeenCalledWith('p1'));
    // The heart flips to the "remove" (wishlisted) state.
    const btn = await screen.findByRole('button', { name: /remove ring from wishlist/i });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('optimistically removes when the product is already wishlisted', async () => {
    idsMock.mockResolvedValue(['p1']);
    const user = userEvent.setup();
    renderButton();

    const btn = await screen.findByRole('button', { name: /remove ring from wishlist/i });
    await user.click(btn);

    await waitFor(() => expect(removeMock).toHaveBeenCalledWith('p1'));
    await screen.findByRole('button', { name: /add ring to wishlist/i });
  });

  it('rolls back the optimistic add when the API fails', async () => {
    addMock.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole('button', { name: /add ring to wishlist/i }));

    await waitFor(() => expect(addMock).toHaveBeenCalled());
    // Rolled back: still the "add" (not wishlisted) state, and an error toast fired.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /add ring to wishlist/i })).toHaveAttribute('aria-pressed', 'false'),
    );
    expect(toast.error).toHaveBeenCalled();
  });

  it('makes no wishlist calls when logged out', async () => {
    authed = false;
    renderButton();

    await waitFor(() => expect(screen.getByRole('button', { name: /add ring to wishlist/i })).toBeInTheDocument());
    expect(idsMock).not.toHaveBeenCalled();
  });

  it('redirects to sign in (does not call the API) when logged out and clicked', async () => {
    authed = false;
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole('button', { name: /add ring to wishlist/i }));

    expect(await screen.findByText('login page')).toBeInTheDocument();
    expect(addMock).not.toHaveBeenCalled();
  });
});
