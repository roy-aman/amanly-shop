import { useQuery } from '@tanstack/react-query';

import { adminStore } from '@/api/admin';
import { getPublicStore } from '@/api/store';

/* ===================================================================
   Which sections of the shop this store actually has

   Every storefront on the platform ships the SAME code — the same
   catalogue, cart, wishlist, reviews, coupons, banners, returns and
   booking suite, and the same console. What differs per shop is which
   of those sections the platform has granted it, and that is decided
   here, at runtime, from the store payload.

   The alternative — cutting features out of a store's repo at build
   time — is what this replaces. A section that has been deleted cannot
   be given back without a developer and a deploy; a section that ships
   and is gated comes back the moment an operator ticks a box, with the
   shop's own coupons, reviews and wishlists still behind it, because
   withdrawing one hides it and deletes nothing.

   So: no build-time constants, no per-store bundles, and no route that
   exists only in some shops. Gate on this.
   =================================================================== */

/**
 * One per top-level group of the console's navigation, plus the two ways of
 * taking money online. Deliberately coarse: a merchant does not buy "brands",
 * they buy a shop, and the pages inside a group are how that group works rather
 * than things sold apart from it.
 */
export const STORE_FEATURES = [
  'OVERVIEW',
  'CATALOG',
  'SALES',
  'BOOKINGS',
  'PEOPLE',
  'INSIGHTS',
  'SYSTEM',
  'PAYMENT_GATEWAY',
  'CUSTOM_UPI',
] as const;

export type StoreFeature = (typeof STORE_FEATURES)[number];

export interface FeatureGate {
  /** Whether this store may show a section. */
  has: (feature: StoreFeature) => boolean;
  /** True until the store payload has landed. Render a skeleton, not an absence. */
  loading: boolean;
  /**
   * False when the backend does not report sections at all — see
   * {@link resolveHas}. Useful for a console that wants to explain why the
   * section panel is missing rather than showing an empty one.
   */
  gated: boolean;
}

/**
 * The rule for reading a `features` list, and the one subtlety in this file.
 *
 * An ABSENT list and an EMPTY list mean opposite things, and conflating them
 * breaks one deployment or the other:
 *
 * - `undefined` — the backend predates section gating, or the payload was
 *   cached before it did. That backend serves every section to everyone, so
 *   the honest reading is "nothing is gated here". Failing closed instead would
 *   turn a perfectly good shop into an empty one the moment this bundle shipped
 *   ahead of the backend, which is the normal order of a release.
 * - `[]` — a backend that knows about sections, telling us this store has none.
 *   Show nothing.
 *
 * Note that this differs from the convention for boolean flags like
 * `bookingsEnabled`, where absent DOES read as off. The difference is that a
 * missing boolean says nothing about the deployment, while a missing list of
 * sections says the deployment has no concept of them.
 *
 * Unknown names in the list are ignored rather than treated as errors: a newer
 * backend will name sections this bundle has never heard of, and a shop must
 * not break because it was granted one.
 */
function resolveHas(features: string[] | undefined): { has: (f: StoreFeature) => boolean; gated: boolean } {
  if (!Array.isArray(features)) {
    return { has: () => true, gated: false };
  }
  const granted = new Set(features);
  return { has: (feature) => granted.has(feature), gated: true };
}

/**
 * Storefront gate. Shares the `['public-store']` query the app boots with, so
 * this costs no extra request wherever it is called.
 *
 * Reports what is AVAILABLE rather than merely granted: a store entitled to
 * bookings but not open for them, or to a gateway with half its keys entered,
 * is absent from the list the server sends. That is the server's job, not this
 * hook's — never reconstruct an effective flag from parts here.
 */
export function useStoreFeatures(): FeatureGate {
  const { data, isLoading } = useQuery({
    queryKey: ['public-store'],
    queryFn: getPublicStore,
    staleTime: 5 * 60_000,
  });

  const { has, gated } = resolveHas(data?.features);
  return { has, loading: isLoading, gated };
}

/**
 * Console gate. Reads the ENTITLEMENTS rather than the effective answer.
 *
 * The difference is deliberate and matters: a merchant sets a section up before
 * switching it on, so the console shows the booking pages to a store that is
 * entitled but not yet open. It is also why the server answers a console call
 * with 403 `<SECTION>_NOT_ALLOWED` where the storefront gets 404
 * `<SECTION>_NOT_AVAILABLE` — the merchant is being told something they can act
 * on, and the UI should say so rather than pretending the page never existed.
 *
 * It reads `/admin/store/features` and NOT `/admin/store`, which is the whole
 * reason that endpoint exists. The settings payload is ADMIN-only — it carries
 * payment keys — so a STAFF user got a 403 and this gate got no answer. And no
 * answer has to mean "nothing is gated", or every shop empties the moment this
 * bundle ships ahead of a backend that reports sections. Those two rules
 * together showed staff every section regardless of what the store was granted:
 * the gate silently did nothing for the role that lives in the console.
 */
export function useConsoleFeatures(): FeatureGate {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'store', 'features'],
    queryFn: adminStore.features,
    staleTime: 5 * 60_000,
    // An older backend has no such endpoint. One 404 is the answer; retrying it
    // just delays the console's first paint behind a request that cannot succeed.
    retry: false,
  });

  const { has, gated } = resolveHas(data?.features);
  return { has, loading: isLoading, gated };
}
