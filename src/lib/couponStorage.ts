/**
 * Tiny localStorage bridge for the coupon the shopper has applied on the Cart page,
 * so Checkout can pick it up and carry it into `placeOrder`. Only the code is stored
 * (the discount itself is always recomputed server-side). All access is guarded so a
 * disabled/full storage (private mode, quota) degrades to "no coupon" rather than
 * throwing.
 */
const KEY = 'rc-applied-coupon';

export function getStoredCoupon(): string | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && v.trim() ? v : null;
  } catch {
    return null;
  }
}

export function setStoredCoupon(code: string): void {
  try {
    localStorage.setItem(KEY, code);
  } catch {
    /* ignore persistence failure */
  }
}

export function clearStoredCoupon(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
