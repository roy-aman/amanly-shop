import { request } from '@/lib/http';
import type { PublicStoreResponse } from '@/lib/types';

/**
 * Which store this address serves.
 *
 * The storefront's first call and the only one that answers from an origin the backend does not
 * recognise — a `404 STORE_NOT_MAPPED` here is the answer "nobody has attached this address to a
 * store", and every other endpoint would hide that behind a CORS failure instead.
 *
 * `claimStore: false` because this is the call that *learns* the slug. Sending a stale one would
 * make the server reject the request that exists to correct it.
 */
export function getPublicStore(): Promise<PublicStoreResponse> {
  return request('GET', '/api/v1/store', { claimStore: false });
}
