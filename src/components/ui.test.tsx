import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// Import through the `@` alias to prove Vitest resolves it like the app does.
import { Badge, LinkButton, Pagination } from '@/components/ui';
import { renderWithProviders } from '@/test/utils';

describe('UI kit smoke tests', () => {
  it('renders a Badge with its children', () => {
    renderWithProviders(<Badge tone="green">Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders a LinkButton as an anchor pointing at its route (needs Router provider)', () => {
    renderWithProviders(<LinkButton to="/products">Shop</LinkButton>);
    const link = screen.getByRole('link', { name: 'Shop' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/products');
  });

  describe('Pagination', () => {
    it('renders nothing when there is a single page', () => {
      const { container } = renderWithProviders(
        <Pagination page={0} totalPages={1} onChange={() => {}} />,
      );
      expect(container).toBeEmptyDOMElement();
    });

    it('shows the 1-based current page and total', () => {
      renderWithProviders(<Pagination page={0} totalPages={3} onChange={() => {}} />);
      // "Page 1 of 3" is split across spans, so match the human-visible number.
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText(/of 3/)).toBeInTheDocument();
    });

    it('disables Previous on the first page and Next on the last', () => {
      const { rerender } = renderWithProviders(
        <Pagination page={0} totalPages={3} onChange={() => {}} />,
      );
      expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();

      rerender(<Pagination page={2} totalPages={3} onChange={() => {}} />);
      expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    });

    it('invokes onChange with the next page index when Next is clicked', async () => {
      const onChange = vi.fn();
      renderWithProviders(<Pagination page={0} totalPages={3} onChange={onChange} />);
      await userEvent.click(screen.getByRole('button', { name: 'Next' }));
      expect(onChange).toHaveBeenCalledWith(1);
    });
  });
});
