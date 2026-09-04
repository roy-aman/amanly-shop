import { useQuery } from '@tanstack/react-query';

import { getPublicStore } from '@/api/store';

/* ===================================================================
   What this shop calls things

   Every store runs the same pages. A cake shop's customers browse
   CAKES by OCCASION, not products by category — and that is a rename,
   not a fork: the page, its filters, its API calls and its tests are
   identical underneath.

   The words live on the store and arrive with the store payload, so a
   merchant who decides they sell "bakes" rather than "cakes" changes a
   setting rather than waiting for a release. Which is the whole point:
   a noun typed into a heading here would need a developer to undo.
   =================================================================== */

/**
 * Every term the platform knows, with its default word.
 *
 * This map is the FALLBACK, not the source. The server sends the resolved set
 * on every bootstrap; these values are what renders when a key is missing from
 * it — an older backend, a payload cached before a term was added, or a request
 * that has not landed yet. A heading that renders `undefined` is worse than one
 * that renders the platform's own word.
 *
 * Singular and plural are separate keys on purpose. English plurals are not
 * derivable ("occasion"/"occasions", but "box"/"boxes"), and a pluraliser being
 * wrong is wrong in public — so never build one by appending an "s".
 */
export const LEXICON_DEFAULTS = {
  // Customer-facing nouns
  product: 'Product',
  products: 'Products',
  category: 'Category',
  categories: 'Categories',
  brand: 'Brand',
  brands: 'Brands',
  variant: 'Option',
  variants: 'Options',
  cart: 'Cart',
  order: 'Order',
  orders: 'Orders',
  coupon: 'Coupon',
  coupons: 'Coupons',
  wishlist: 'Wishlist',
  review: 'Review',
  reviews: 'Reviews',
  service: 'Service',
  services: 'Services',
  booking: 'Booking',
  bookings: 'Bookings',
  staffMember: 'Specialist',
  staff: 'Team',
  customer: 'Customer',
  customers: 'Customers',

  // Console navigation. Separate from the nouns above because the console
  // rarely uses the same word: a shop that sells "cakes" still has an
  // Inventory page, and renaming that page is a different decision from
  // renaming the thing on it.
  'nav.overview': 'Overview',
  'nav.dashboard': 'Dashboard',
  'nav.catalog': 'Catalog',
  'nav.inventory': 'Inventory',
  'nav.categories': 'Categories',
  'nav.brands': 'Brands',
  'nav.banners': 'Banners',
  'nav.reviews': 'Reviews',
  'nav.sales': 'Sales',
  'nav.orders': 'Orders',
  'nav.deliverables': 'Deliverables',
  'nav.coupons': 'Coupons',
  'nav.bookings': 'Bookings',
  'nav.diary': 'Diary',
  'nav.services': 'Services',
  'nav.serviceGroups': 'Service groups',
  'nav.team': 'Team',
  'nav.serviceReviews': 'Service reviews',
  'nav.bookingSetup': 'Booking setup',
  'nav.people': 'People',
  'nav.users': 'Users',
  'nav.insights': 'Insights',
  'nav.reports': 'Reports',
  'nav.system': 'System',
  'nav.storeQr': 'Store QR code',
  'nav.settings': 'Settings',
} as const;

export type LexiconKey = keyof typeof LEXICON_DEFAULTS;

export interface Lexicon {
  /** This shop's word for a term, capitalised as the merchant typed it. */
  t: (key: LexiconKey) => string;
  /**
   * Lower-cased, for mid-sentence use — "no {t.lower('products')} yet".
   *
   * Only the first character is touched, so a merchant who deliberately typed
   * "Diwali Boxes" keeps their capital B. Blindly lower-casing the whole string
   * would quietly rewrite a proper noun.
   */
  lower: (key: LexiconKey) => string;
}

function decapitalise(word: string): string {
  return word.charAt(0).toLowerCase() + word.slice(1);
}

/**
 * The shop's vocabulary. Shares the `['public-store']` query the app already
 * boots with, so it costs no extra request.
 *
 * Used by the console as well as the storefront: the nav labels a merchant
 * reads all day are the same data, and there is no second place they could
 * disagree.
 */
export function useLexicon(): Lexicon {
  const { data } = useQuery({
    queryKey: ['public-store'],
    queryFn: getPublicStore,
    staleTime: 5 * 60_000,
  });

  const terms = data?.lexicon;
  const t = (key: LexiconKey): string => {
    const word = terms?.[key];
    return word && word.trim() ? word : LEXICON_DEFAULTS[key];
  };

  return { t, lower: (key) => decapitalise(t(key)) };
}
