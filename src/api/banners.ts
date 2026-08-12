import { buildQuery, request } from '@/lib/http';
import type {
  BannerPlacement,
  BannerResponse,
  CreateBannerRequest,
  UpdateBannerRequest,
} from '@/lib/types';

const A = '/api/v1/admin/banners';

/**
 * Live banners for one placement (public).
 *
 * Only what is switched on and inside its schedule, already in display order —
 * the filtering happens in SQL, so the storefront never sees a store's expired
 * or scheduled banners. An empty array means "no banner booked", which the page
 * renders as nothing rather than as an error.
 */
export function listBanners(placement: BannerPlacement): Promise<BannerResponse[]> {
  return request('GET', `/api/v1/banners${buildQuery({ placement })}`);
}

/** Banner management (ADMIN, STAFF) — the same people who manage the catalogue. */
export const adminBanners = {
  /** Everything, including scheduled, expired and switched-off banners. Each
   *  row carries `live` saying whether a customer can currently see it. */
  list(placement?: BannerPlacement): Promise<BannerResponse[]> {
    return request('GET', `${A}${buildQuery({ placement })}`, { auth: true });
  },
  get(id: string): Promise<BannerResponse> {
    return request('GET', `${A}/${id}`, { auth: true });
  },
  create(body: CreateBannerRequest): Promise<BannerResponse> {
    return request('POST', A, { body, auth: true });
  },
  /** A full replacement — omitted optional fields are cleared. */
  update(id: string, body: UpdateBannerRequest): Promise<BannerResponse> {
    return request('PUT', `${A}/${id}`, { body, auth: true });
  },
  /** The one-click switch. Leaves the schedule intact. */
  setActive(id: string, active: boolean): Promise<BannerResponse> {
    return request('PATCH', `${A}/${id}/active${buildQuery({ active })}`, { auth: true });
  },
  remove(id: string): Promise<void> {
    return request('DELETE', `${A}/${id}`, { auth: true });
  },
};
