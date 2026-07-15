import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import ProductCard from './ProductCard';
import type { ProductSummaryResponse } from '@/lib/types';

function summary(overrides: Partial<ProductSummaryResponse> = {}): ProductSummaryResponse {
  return {
    id: 'p1',
    name: 'Signet Ring',
    slug: 'signet-ring',
    sku: 'RING-1',
    price: 120,
    compareAtPrice: null,
    currency: 'USD',
    status: 'ACTIVE',
    categoryName: 'Rings',
    primaryImageUrl: null,
    stockQuantity: 5,
    ...overrides,
  };
}

describe('ProductCard rating', () => {
  it('shows rating stars when ratingAvg/ratingCount are present', () => {
    renderWithProviders(<ProductCard product={summary({ ratingAvg: 4.5, ratingCount: 12 })} />);
    expect(screen.getByLabelText(/Rated 4\.5 out of 5/)).toBeInTheDocument();
    expect(screen.getByText('(12)')).toBeInTheDocument();
  });

  it('hides the rating cleanly when there are no reviews (null avg / zero count)', () => {
    renderWithProviders(<ProductCard product={summary({ ratingAvg: null, ratingCount: 0 })} />);
    expect(screen.queryByLabelText(/Rated/)).not.toBeInTheDocument();
    expect(screen.queryByText('(0)')).not.toBeInTheDocument();
  });

  it('hides the rating when the fields are absent (backward-compatible summary)', () => {
    renderWithProviders(<ProductCard product={summary()} />);
    expect(screen.queryByLabelText(/Rated/)).not.toBeInTheDocument();
  });
});
