/* ===================================================================
   Amanly — order & cart money breakdown (WP-P.6)

   One place for the arithmetic, because there are two very different
   sources of truth and mixing them up is a consumer-law problem rather
   than a cosmetic one:

   - A PLACED order carries its own figures, snapshotted at placement.
     Never recompute them; store settings may have changed since.
   - BEFORE placement there is no totals endpoint, so the storefront
     applies the store's published rules itself. That number is an
     ESTIMATE and must be labelled as one — the order response wins.
   =================================================================== */

import type { OrderResponse, PublicStoreResponse } from './types';

export interface MoneyBreakdown {
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  /** The amount payable. */
  total: number;
  /** true → tax already sits inside the prices and must NOT be added again. */
  taxInclusive: boolean;
  taxRatePercent: number;
  /** Whether a tax line is worth rendering at all. */
  hasTax: boolean;
  /** False when the source carried no delivery figure at all. Distinguishes
   *  "delivery was free" from "we do not know what delivery cost" — rendering
   *  the second as "Free" states something the data never said. */
  hasShipping: boolean;
}

/**
 * Read a placed order's breakdown.
 *
 * `totalAmount` is passed through untouched — it is the figure the customer was
 * charged. The other lines fall back for payloads that predate WP-P.6 (a cached
 * order, an older backend), where subtotal can only be reconstructed from total
 * plus discount.
 */
export function orderTotals(order: OrderResponse): MoneyBreakdown {
  const discount = order.discountAmount ?? 0;
  const shipping = order.shippingAmount ?? 0;
  const tax = order.taxAmount ?? 0;
  const taxInclusive = order.taxInclusive ?? true;
  const subtotal =
    order.subtotalAmount ??
    // Pre-WP-P.6 fallback: shipping and tax did not exist, so total + discount
    // was the goods figure.
    order.totalAmount + discount;

  return {
    subtotal,
    discount,
    shipping,
    tax,
    total: order.totalAmount,
    taxInclusive,
    taxRatePercent: order.taxRatePercent ?? 0,
    hasTax: tax > 0,
    hasShipping: order.shippingAmount != null,
  };
}

/**
 * Estimate what a cart will cost before it is placed.
 *
 * Mirrors the server's rules: the threshold is tested against the DISCOUNTED
 * subtotal, and exclusive tax applies to goods *and* delivery. Returns null when
 * the store has not published commerce settings, which is the signal to keep
 * saying "calculated at checkout" rather than to guess.
 */
export function estimateCartTotals(
  subtotal: number,
  discount: number,
  store: PublicStoreResponse | undefined,
): MoneyBreakdown | null {
  if (!store || store.shippingFlatAmount == null || store.pricesIncludeTax == null) return null;

  const rate = store.taxRatePercent ?? 0;
  const discounted = Math.max(0, subtotal - discount);
  const threshold = store.freeShippingThreshold;
  const shipping = threshold != null && discounted >= threshold ? 0 : store.shippingFlatAmount;
  const taxable = discounted + shipping;

  // Inclusive: the tax is the slice already inside `taxable`, so it is backed
  // out rather than added. Exclusive: it is charged on top.
  const tax = rate <= 0 ? 0 : store.pricesIncludeTax ? taxable - taxable / (1 + rate / 100) : (taxable * rate) / 100;

  return {
    subtotal,
    discount,
    shipping,
    tax,
    total: store.pricesIncludeTax ? taxable : taxable + tax,
    taxInclusive: store.pricesIncludeTax,
    taxRatePercent: rate,
    hasTax: rate > 0,
    hasShipping: true,
  };
}

/**
 * How much more a shopper must spend to get free delivery, or null when that
 * message does not apply (no threshold, already qualified, or no settings).
 */
export function amountToFreeShipping(
  discountedSubtotal: number,
  store: PublicStoreResponse | undefined,
): number | null {
  const threshold = store?.freeShippingThreshold;
  if (threshold == null || discountedSubtotal >= threshold) return null;
  return threshold - discountedSubtotal;
}

/** Short suffix for a displayed price, e.g. "incl. tax". Empty when the store
 *  charges no tax — a "+ 0% tax" label is noise. */
export function taxLabel(store: PublicStoreResponse | undefined): string {
  if (!store || store.pricesIncludeTax == null || !store.taxRatePercent) return '';
  return store.pricesIncludeTax ? 'incl. tax' : '+ tax at checkout';
}
