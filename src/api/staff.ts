import { buildQuery, request } from '@/lib/http';
import type { PublicStaffResponse, SaveStaffProfileRequest, StaffProfileResponse } from '@/lib/types';

const A = '/api/v1/admin/staff-profiles';

/**
 * Who takes appointments (public, unpaged, already ordered).
 *
 * Pass `serviceId` to get only the people who work in that service's group. The
 * narrowing is the server's to do, not a filter applied to a full list the
 * storefront should not have been handed.
 *
 * A service with no group, or a group nobody has been assigned to, answers with
 * the whole team — an empty picker would read as a service that cannot be
 * booked. So "anyone available" stays the right default either way.
 */
export function listStaff(serviceId?: string): Promise<PublicStaffResponse[]> {
  return request('GET', `/api/v1/staff${buildQuery({ serviceId })}`);
}

/** Team management (ADMIN, STAFF). Deletes are ADMIN only. */
export const adminStaffProfiles = {
  list(): Promise<StaffProfileResponse[]> {
    return request('GET', A, { auth: true });
  },
  get(staffProfileId: string): Promise<StaffProfileResponse> {
    return request('GET', `${A}/${staffProfileId}`, { auth: true });
  },
  /**
   * Linking a `userId` connects this profile to a console login. The account
   * must be an active STAFF or ADMIN member of this store (400
   * STAFF_USER_NOT_ELIGIBLE) and may not already be linked elsewhere (409
   * STAFF_USER_ALREADY_LINKED) — both belong on the field, not in a toast.
   */
  create(body: SaveStaffProfileRequest): Promise<StaffProfileResponse> {
    return request('POST', A, { body, auth: true });
  },
  /** Same payload as create; a full replace. */
  update(staffProfileId: string, body: SaveStaffProfileRequest): Promise<StaffProfileResponse> {
    return request('PUT', `${A}/${staffProfileId}`, { body, auth: true });
  },
  /** ADMIN only; 409 STAFF_HAS_BOOKINGS once they appear in the diary. */
  remove(staffProfileId: string): Promise<void> {
    return request('DELETE', `${A}/${staffProfileId}`, { auth: true });
  },
};
