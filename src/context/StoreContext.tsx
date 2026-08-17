import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getPublicStore } from '@/api/store';
import { ApiError, StoreScope, setStoreContextStaleHandler } from '@/lib/http';
import StoreNotMapped from '@/pages/StoreNotMapped';
import type { PublicStoreResponse } from '@/lib/types';

/**
 * Codes the backend uses for "this address belongs to no store".
 *
 * Two of them because the message was renamed: a deployment still running the older backend
 * answers STORE_NOT_FOUND. Both are treated the same so this build works against either, which is
 * what lets the UI ship before the backend does.
 */
const UNMAPPED_CODES = ['STORE_NOT_MAPPED', 'STORE_NOT_FOUND'];

interface StoreContextValue {
  store: PublicStoreResponse | undefined;
  isLoading: boolean;
  /** This address is attached to no store. The app cannot show anything useful. */
  isUnmapped: boolean;
}

const StoreContext = createContext<StoreContextValue>({
  store: undefined,
  isLoading: false,
  isUnmapped: false,
});

export function useStore(): StoreContextValue {
  return useContext(StoreContext);
}

/**
 * Learns which store this address serves, once, and keeps the answer.
 *
 * The same query key the layouts already use, so they read this result out of the react-query
 * cache rather than making a second request.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-store'],
    queryFn: getPublicStore,
    staleTime: 5 * 60_000,
    // An unmapped address is a settled answer, not a blip. Retrying it delays the explanation and
    // achieves nothing; anything else keeps the one retry the app uses everywhere.
    retry: (failureCount, err) =>
      !(err instanceof ApiError && UNMAPPED_CODES.includes(err.code)) && failureCount < 1,
  });

  // Persisted so it survives a reload and so requests can carry it back as a claim. Written here
  // rather than in the fetcher because this is the one place that knows the answer is current.
  useEffect(() => {
    if (data?.slug) StoreScope.set(data.slug);
  }, [data?.slug]);

  // The server told some other request that our slug is not this address's store — which means
  // this cached store is the wrong shop's. Refetch rather than patch: the name, currency, tax
  // rules and payment methods all belong to whichever store it really is.
  useEffect(() => {
    setStoreContextStaleHandler(() => {
      void queryClient.invalidateQueries({ queryKey: ['public-store'] });
    });
  }, [queryClient]);

  const isUnmapped = error instanceof ApiError && UNMAPPED_CODES.includes(error.code);

  return (
    <StoreContext.Provider value={{ store: data, isLoading, isUnmapped }}>{children}</StoreContext.Provider>
  );
}

/**
 * Replaces the app with an explanation when this address serves no store.
 *
 * Deliberately gates on *that* answer alone and not on loading or on any other failure. The layouts
 * already render without a store — the header falls back to the brand name, the nav to an empty
 * menu — so holding the whole app behind this request would trade a working page for a spinner on
 * every visit, and would turn a slow or unreachable API into a blank screen. Only "no store owns
 * this address" is a state where continuing shows something actively misleading.
 */
export function StoreGate({ children }: { children: ReactNode }) {
  const { isUnmapped } = useStore();
  return isUnmapped ? <StoreNotMapped /> : <>{children}</>;
}
