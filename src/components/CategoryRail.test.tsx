import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CategoryRail } from './CategoryRail';
import type { CategoryTreeResponse } from '@/lib/types';

function category(overrides: Partial<CategoryTreeResponse> = {}): CategoryTreeResponse {
  return {
    id: 'c1',
    name: 'Caps',
    slug: 'caps',
    sortOrder: 0,
    imageUrl: null,
    imageAltText: null,
    children: [],
    ...overrides,
  };
}

const CAPS = category();
const BAGS = category({ id: 'c2', name: 'Bags', slug: 'bags' });

describe('CategoryRail', () => {
  it('offers every root plus a way back to everything', () => {
    render(<CategoryRail categories={[CAPS, BAGS]} activeId="" onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Caps' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bags' })).toBeInTheDocument();
  });

  it('reports the chosen category to its owner rather than holding it', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<CategoryRail categories={[CAPS, BAGS]} activeId="" onSelect={onSelect} />);

    await user.click(screen.getByRole('button', { name: 'Bags' }));

    expect(onSelect).toHaveBeenCalledWith('c2');
  });

  it('marks the active category, and makes tapping it the way back out', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<CategoryRail categories={[CAPS, BAGS]} activeId="c1" onSelect={onSelect} />);

    const caps = screen.getByRole('button', { name: 'Caps' });
    expect(caps).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');

    await user.click(caps);
    expect(onSelect).toHaveBeenCalledWith(undefined);
  });

  it('shows the merchant photograph when there is one', () => {
    render(
      <CategoryRail
        categories={[category({ imageUrl: 'https://cdn.test/caps.jpg', imageAltText: 'Folded caps' }), BAGS]}
        activeId=""
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByAltText('Folded caps')).toHaveAttribute('src', 'https://cdn.test/caps.jpg');
  });

  /** No photo is the normal early state — an initial reads as designed, a broken tile does not. */
  it('falls back to the initial when no photograph has been uploaded', () => {
    render(<CategoryRail categories={[CAPS, BAGS]} activeId="" onSelect={vi.fn()} />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Caps' })).toHaveTextContent('C');
  });

  /** One category is not a choice, and none is not a row. */
  it('stays out of the way when there is nothing to choose between', () => {
    const { container, rerender } = render(
      <CategoryRail categories={[CAPS]} activeId="" onSelect={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();

    rerender(<CategoryRail categories={[]} activeId="" onSelect={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows placeholders rather than an empty strip while the tree loads', () => {
    render(<CategoryRail categories={[]} activeId="" onSelect={vi.fn()} loading />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
