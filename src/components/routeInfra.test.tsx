import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RouteTitle, TITLE_BASE, useDocumentTitle } from '@/lib/useDocumentTitle';

function Titled({ title }: { title?: string }) {
  useDocumentTitle(title);
  return <p>ok</p>;
}

describe('useDocumentTitle', () => {
  it('prefixes the brand and sets document.title', () => {
    render(<Titled title="Products" />);
    expect(document.title).toBe(`${TITLE_BASE} — Products`);
  });

  it('falls back to the bare brand when no title is given', () => {
    render(<Titled />);
    expect(document.title).toBe(TITLE_BASE);
  });

  it('RouteTitle renders nothing but sets the title', () => {
    const { container } = render(<RouteTitle title="Checkout" />);
    expect(container).toBeEmptyDOMElement();
    expect(document.title).toBe(`${TITLE_BASE} — Checkout`);
  });
});

function Boom(): never {
  throw new Error('kaboom');
}

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <MemoryRouter>
        <ErrorBoundary>
          <p>healthy content</p>
        </ErrorBoundary>
      </MemoryRouter>,
    );
    expect(screen.getByText('healthy content')).toBeInTheDocument();
  });

  it('renders the branded 500 screen with recovery actions when a child throws', () => {
    // React logs caught errors to console.error; silence it for a clean run.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <MemoryRouter>
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>
      </MemoryRouter>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/');
    spy.mockRestore();
  });
});
