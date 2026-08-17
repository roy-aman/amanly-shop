import { buildQuery, request } from '@/lib/http';
import type {
  AddStoreDomainRequest,
  ChangeUserRolesRequest,
  CreateStoreRequest,
  ErrorEventDetailResponse,
  ErrorEventResponse,
  ErrorSource,
  GrantPlatformAdminRequest,
  Page,
  PlatformAdminResponse,
  StoreAdminSummaryResponse,
  StoreDomainResponse,
  UpdateStoreDomainRequest,
  UpdateStoreEntitlementsRequest,
  UpdateStoreRequest,
  UserResponse,
} from '@/lib/types';

/**
 * The platform surface — managing the OTHER stores on the platform. Every route
 * requires PLATFORM_ADMIN and is enforced server-side (403 regardless of what
 * the UI renders).
 *
 * These go through the SAME origin as the storefront, deliberately: the backend
 * resolves the current store from the Host header, and a separate API base for
 * the platform screens would resolve the wrong one. There is no store selector
 * here — the store is always an explicit `storeId` in the path.
 */
const P = '/api/v1/platform';

export const platformStores = {
  /** Every store, newest-agnostic order. Not paginated — a plain array. */
  list(): Promise<StoreAdminSummaryResponse[]> {
    return request('GET', `${P}/stores`, { auth: true });
  },

  get(storeId: string): Promise<StoreAdminSummaryResponse> {
    return request('GET', `${P}/stores/${storeId}`, { auth: true });
  },

  /** 409 STORE_SLUG_EXISTS / STORE_DOMAIN_TAKEN; 400 ADMIN_PASSWORD_REQUIRED
   *  when `adminEmail` is given without a password. */
  create(body: CreateStoreRequest): Promise<StoreAdminSummaryResponse> {
    return request('POST', `${P}/stores`, { body, auth: true });
  },

  /** Rename, suspend or close. CLOSED stops a store trading and is reversible —
   *  prefer it to {@link remove} for a real business that has stopped. */
  update(storeId: string, body: UpdateStoreRequest): Promise<StoreAdminSummaryResponse> {
    return request('PATCH', `${P}/stores/${storeId}`, { body, auth: true });
  },

  /**
   * Erases a store and everything belonging to it. **There is no undo.**
   *
   * Removes the catalogue, orders and their history, carts, coupons, reviews,
   * bookings, settings, addresses and every membership. People are NOT deleted:
   * an account is global and simply loses this membership.
   *
   * `confirmSlug` must equal the store's own slug (400
   * STORE_CONFIRMATION_MISMATCH) — an id is copied from a list and a mistake
   * looks like any other UUID. No store is protected any more: there is no
   * fallback answering unmatched addresses, so erasing one takes down exactly
   * its own addresses and nobody else's.
   */
  remove(storeId: string, confirmSlug: string): Promise<void> {
    return request('DELETE', `${P}/stores/${storeId}${buildQuery({ confirmSlug })}`, { auth: true });
  },

  /** Applied as sent — send every field, not just what changed. */
  updateEntitlements(storeId: string, body: UpdateStoreEntitlementsRequest): Promise<StoreAdminSummaryResponse> {
    return request('PATCH', `${P}/stores/${storeId}/entitlements`, { body, auth: true });
  },
};

export const platformDomains = {
  list(storeId: string): Promise<StoreDomainResponse[]> {
    return request('GET', `${P}/stores/${storeId}/domains`, { auth: true });
  },

  /** 409 CUSTOM_DOMAIN_NOT_ALLOWED (entitlement off) / DOMAIN_TAKEN (held by
   *  some other store — the error will not say which, on purpose). */
  add(storeId: string, body: AddStoreDomainRequest): Promise<StoreDomainResponse> {
    return request('POST', `${P}/stores/${storeId}/domains`, { body, auth: true });
  },

  /** Re-points a mapping, keeping its id and primary flag — the ordinary
   *  lifecycle as a shop moves from a dev address to its real domain. 409
   *  DOMAIN_TAKEN if another store holds the new one. Preferred to
   *  remove-then-add, which is refused for the primary while others remain. */
  rename(storeId: string, domainId: string, body: UpdateStoreDomainRequest): Promise<StoreDomainResponse> {
    return request('PUT', `${P}/stores/${storeId}/domains/${domainId}`, { body, auth: true });
  },

  makePrimary(storeId: string, domainId: string): Promise<StoreDomainResponse> {
    return request('PATCH', `${P}/stores/${storeId}/domains/${domainId}/primary`, { auth: true });
  },

  /** 409 CANNOT_REMOVE_PRIMARY_DOMAIN while other domains remain — promote
   *  another first. Removing the last domain is allowed. */
  remove(storeId: string, domainId: string): Promise<void> {
    return request('DELETE', `${P}/stores/${storeId}/domains/${domainId}`, { auth: true });
  },
};

/**
 * A store's members, addressed by store id rather than by hostname.
 *
 * `adminUsers` in admin.ts hits the same underlying service, but it reads the store from the Host
 * header — which on the platform screens is the platform's own hostname, not the store being looked
 * at. It would answer for the wrong store without erroring, so the platform console uses these.
 */
export const platformStoreUsers = {
  list(
    storeId: string,
    params: { search?: string; page?: number; size?: number; sort?: string } = {},
  ): Promise<Page<UserResponse>> {
    return request('GET', `${P}/stores/${storeId}/users${buildQuery(params)}`, { auth: true });
  },

  /** Roles are replaced wholesale — send the full set, not a delta.
   *  403 CANNOT_MODIFY_PLATFORM_ADMIN when the target is a fellow operator;
   *  409 STAFF_SEAT_LIMIT_REACHED when promoting past the store's seat entitlement.
   *  PLATFORM_ADMIN is not assignable here — use platformAdmins.grant. */
  changeRoles(
    storeId: string,
    userId: string,
    roles: ChangeUserRolesRequest['roles'],
  ): Promise<UserResponse> {
    return request('PATCH', `${P}/stores/${storeId}/users/${userId}/roles`, {
      body: { roles },
      auth: true,
    });
  },
};

/**
 * Recorded failures — things that actually broke, not requests the API refused.
 *
 * Rows are grouped: one per distinct failure, with `occurrences` counting how often it has happened.
 * A rejected login or a forbidden action never appears here by design, so anything in this list is
 * worth looking at.
 */
export const platformErrors = {
  /**
   * `openOnly` hides both resolved and muted — turn it off to find a muted issue again.
   *
   * `sources` narrows to a group. Joined with commas rather than repeated as `source=A&source=B`
   * because `buildQuery` stringifies a value once per key; Spring binds either form to the same
   * `List<ErrorSource>`, and doing it here keeps the shared helper unchanged. An empty array is sent
   * as nothing at all — the server treats an empty list as "no filter", but a bare `source=` would
   * be a parse error rather than a no-op.
   */
  list(
    params: {
      storeId?: string;
      since?: string;
      openOnly?: boolean;
      sources?: ErrorSource[];
      page?: number;
      size?: number;
    } = {},
  ): Promise<Page<ErrorEventResponse>> {
    const { sources, ...rest } = params;
    const query = buildQuery({ ...rest, source: sources?.length ? sources.join(',') : undefined });
    return request('GET', `${P}/errors${query}`, { auth: true });
  },

  get(id: string): Promise<ErrorEventDetailResponse> {
    return request('GET', `${P}/errors/${id}`, { auth: true });
  },

  /** Turns a reference from a bug report (ERR-7K4QP2X9) into the failure behind it. */
  getByReference(reference: string): Promise<ErrorEventDetailResponse> {
    return request('GET', `${P}/errors/by-reference/${reference}`, { auth: true });
  },

  /** Resolving means "fixed". A recurrence reopens it server-side, because a fix that did not hold
   *  is news. */
  setResolved(id: string, resolved: boolean): Promise<ErrorEventDetailResponse> {
    return request('PATCH', `${P}/errors/${id}/resolved${buildQuery({ resolved })}`, { auth: true });
  },

  /** Muting means "stop recording this". Occurrences stop counting entirely and a recurrence does
   *  NOT unmute it — that is the whole difference from resolving. */
  setMuted(id: string, muted: boolean): Promise<ErrorEventDetailResponse> {
    return request('PATCH', `${P}/errors/${id}/muted${buildQuery({ muted })}`, { auth: true });
  },

  /** Deleting a MUTED issue also removes its mute, so the next occurrence starts a fresh row and
   *  counting again. To silence something for good, mute it and leave it. */
  remove(id: string): Promise<void> {
    return request('DELETE', `${P}/errors/${id}`, { auth: true });
  },
};

export const platformAdmins = {
  list(): Promise<PlatformAdminResponse[]> {
    return request('GET', `${P}/admins`, { auth: true });
  },

  /** Appoints an account that ALREADY exists; 404 USER_NOT_FOUND otherwise. */
  grant(body: GrantPlatformAdminRequest): Promise<PlatformAdminResponse> {
    return request('POST', `${P}/admins`, { body, auth: true });
  },

  /** 400 CANNOT_REVOKE_OWN_PLATFORM_ADMIN — nobody may remove their own access. */
  revoke(userId: string): Promise<void> {
    return request('DELETE', `${P}/admins/${userId}`, { auth: true });
  },
};
