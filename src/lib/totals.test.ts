import { describe, expect, it } from 'vitest';
import { amountToFreeShipping, estimateCartTotals, orderTotals, taxLabel } from './totals';
import type { OrderResponse, PublicStoreResponse } from './types';

function store(overrides: Partial<PublicStoreResponse> = {}): PublicStoreResponse {
  return {
    slug: 'amanly',
    name: 'Amanly',
    currency: 'INR',
    codEnabled: true,
    onlinePaymentEnabled: true,
    shippingFlatAmount: 49,
    freeShippingThreshold: 999,
    taxRatePercent: 18,
    pricesIncludeTax: true,
    ...overrides,
  };
}

function order(overrides: Partial<OrderResponse> = {}): OrderResponse {
  return {
    id: 'o1',
    userId: 'u1',
    status: 'PENDING',
    paymentMethod: 'CASH',
    paymentStatus: 'PENDING',
    totalAmount: 1049,
    subtotalAmount: 1000,
    discountAmount: 0,
    shippingAmount: 49,
    taxAmount: 160.07,
    taxRatePercent: 18,
    taxInclusive: true,
    couponCode: null,
    currency: 'INR',
    shippingAddress: {
      name: 'A',
      phone: null,
      addressLine1: 'L1',
      addressLine2: null,
      city: 'C',
      state: null,
      postalCode: '1',
      country: 'IN',
    },
    notes: null,
    items: [],
    paymentAction: null,
    createdAt: '2026-08-09T00:00:00Z',
    updatedAt: '2026-08-09T00:00:00Z',
    ...overrides,
  };
}

describe('orderTotals', () => {
  it('passes the charged total through untouched rather than recomputing it', () => {
    const t = orderTotals(order({ totalAmount: 1234.5 }));
    expect(t.total).toBe(1234.5);
  });

  it('reads an inclusive-tax order without adding the tax on top', () => {
    const t = orderTotals(order());
    // subtotal - discount + shipping === total, tax already inside.
    expect(t.subtotal - t.discount + t.shipping).toBeCloseTo(t.total, 2);
    expect(t.taxInclusive).toBe(true);
  });

  it('reads an exclusive-tax order where tax is part of the total', () => {
    const t = orderTotals(
      order({ taxInclusive: false, subtotalAmount: 1000, shippingAmount: 49, taxAmount: 188.82, totalAmount: 1237.82 }),
    );
    expect(t.subtotal - t.discount + t.shipping + t.tax).toBeCloseTo(t.total, 2);
  });

  it('subtracts a discount from the subtotal line', () => {
    const t = orderTotals(order({ subtotalAmount: 1000, discountAmount: 100, shippingAmount: 0, totalAmount: 900 }));
    expect(t.subtotal).toBe(1000);
    expect(t.discount).toBe(100);
    expect(t.subtotal - t.discount + t.shipping).toBeCloseTo(t.total, 2);
  });

  it('falls back to total + discount for payloads that predate the breakdown', () => {
    const legacy = order({ totalAmount: 900, discountAmount: 100 });
    delete legacy.subtotalAmount;
    delete legacy.shippingAmount;
    delete legacy.taxAmount;
    const t = orderTotals(legacy);
    expect(t.subtotal).toBe(1000);
    expect(t.hasTax).toBe(false);
    // "Unknown" must not be rendered as "Free" — the row is suppressed instead.
    expect(t.hasShipping).toBe(false);
  });

  it('marks a genuinely free delivery as known, not missing', () => {
    expect(orderTotals(order({ shippingAmount: 0 })).hasShipping).toBe(true);
  });
});

describe('estimateCartTotals', () => {
  it('charges flat delivery below the threshold', () => {
    const t = estimateCartTotals(500, 0, store())!;
    expect(t.shipping).toBe(49);
  });

  it('ships free at the threshold exactly', () => {
    const t = estimateCartTotals(999, 0, store())!;
    expect(t.shipping).toBe(0);
  });

  it('tests the threshold against the DISCOUNTED subtotal, not the gross one', () => {
    // 1000 gross clears 999, but a 50 discount drops it back under.
    const t = estimateCartTotals(1000, 50, store())!;
    expect(t.shipping).toBe(49);
    expect(t.total).toBeCloseTo(999, 2);
  });

  it('never ships free when the threshold is null', () => {
    const t = estimateCartTotals(100_000, 0, store({ freeShippingThreshold: null }))!;
    expect(t.shipping).toBe(49);
  });

  it('backs inclusive tax out of the total instead of adding it', () => {
    const t = estimateCartTotals(1000, 0, store({ freeShippingThreshold: null }))!;
    expect(t.total).toBeCloseTo(1049, 2);
    expect(t.tax).toBeCloseTo(1049 - 1049 / 1.18, 2);
  });

  it('adds exclusive tax on goods AND delivery', () => {
    const t = estimateCartTotals(1000, 0, store({ pricesIncludeTax: false, freeShippingThreshold: null }))!;
    expect(t.tax).toBeCloseTo(1049 * 0.18, 2);
    expect(t.total).toBeCloseTo(1049 * 1.18, 2);
  });

  it('returns null when the store has published no commerce rules', () => {
    expect(estimateCartTotals(1000, 0, undefined)).toBeNull();
    expect(estimateCartTotals(1000, 0, store({ shippingFlatAmount: undefined }))).toBeNull();
  });

  it('treats a discount larger than the cart as zero, never negative', () => {
    const t = estimateCartTotals(100, 500, store({ freeShippingThreshold: null }))!;
    expect(t.total).toBeCloseTo(49, 2);
  });
});

describe('amountToFreeShipping', () => {
  it('reports the gap while one remains', () => {
    expect(amountToFreeShipping(900, store())).toBe(99);
  });

  it('is silent once the threshold is met or absent', () => {
    expect(amountToFreeShipping(999, store())).toBeNull();
    expect(amountToFreeShipping(10, store({ freeShippingThreshold: null }))).toBeNull();
    expect(amountToFreeShipping(10, undefined)).toBeNull();
  });
});

describe('taxLabel', () => {
  it('states which side of the price the tax sits on', () => {
    expect(taxLabel(store())).toBe('incl. tax');
    expect(taxLabel(store({ pricesIncludeTax: false }))).toBe('+ tax at checkout');
  });

  it('says nothing when there is no tax to speak of', () => {
    expect(taxLabel(store({ taxRatePercent: 0 }))).toBe('');
    expect(taxLabel(undefined)).toBe('');
  });
});
