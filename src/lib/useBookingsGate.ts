import { useQuery } from '@tanstack/react-query';

import { adminStore } from '@/api/admin';
import { getPublicStore } from '@/api/store';

/* ===================================================================
   Who may see the bookings surface (WP-BU.0)

   Two gates, deliberately asymmetric, because the storefront and the console
   are answering different questions.

   The storefront asks "can this shop take a booking right now" — one flag,
   already the AND of the platform entitlement and the merchant's own switch.

   The console asks "may this shop set bookings up at all", which is the
   entitlement alone. That is what lets a merchant build their menu, hours and
   team in private and go live in one move. It also keeps two very different
   messages apart: "not part of your plan" is a conversation with the platform,
   "bookings are switched off" is a toggle they own.

   Both fail CLOSED. A store payload cached before the field existed, or a
   request that errored, reads as "no bookings" — showing a surface the server
   will 404 is worse than briefly hiding one it would have served.
   =================================================================== */

export interface BookingsGate {
  /** The effective answer: this shop takes bookings now. */
  enabled: boolean;
  loading: boolean;
  /** The shop's IANA zone. Every appointment time on screen is rendered in it. */
  timezone: string;
  businessAddress: string | null;
  currency: string;
}

/**
 * Storefront gate. Shares the `['public-store']` query the app already boots
 * with, so this costs no extra request wherever it is called.
 */
export function useBookingsEnabled(): BookingsGate {
  const { data, isLoading } = useQuery({
    queryKey: ['public-store'],
    queryFn: getPublicStore,
    staleTime: 5 * 60_000,
  });

  return {
    enabled: data?.bookingsEnabled === true,
    loading: isLoading,
    // A shop with bookings on always has a zone; the fallback only matters for
    // the moment before the payload lands, and UTC is the honest placeholder.
    timezone: data?.timezone ?? 'UTC',
    businessAddress: data?.businessAddress ?? null,
    currency: data?.currency ?? 'INR',
  };
}

export interface BookingsEntitlement {
  /** Platform-granted. False means no amount of console work can turn bookings on. */
  bookingsAllowed: boolean;
  /** The merchant's own switch, which they flip in booking settings. */
  bookingsEnabled: boolean;
  loading: boolean;
  timezone: string;
}

/**
 * Console gate. Reads the admin store settings, where the two flags stay apart.
 * Cached for five minutes so it does not re-ask on every navigation.
 */
export function useBookingsEntitlement(): BookingsEntitlement {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'store'],
    queryFn: adminStore.get,
    staleTime: 5 * 60_000,
  });

  return {
    bookingsAllowed: data?.bookingsAllowed === true,
    bookingsEnabled: data?.bookingsEnabled === true,
    loading: isLoading,
    timezone: data?.timezone ?? 'UTC',
  };
}
