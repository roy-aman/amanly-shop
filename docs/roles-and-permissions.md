# Roles and permissions

**Decision (2026-08-09): the three-role model stays.** No per-capability permissions, no custom
roles per store. Revisit only when there are staff whose jobs genuinely differ — see §4 for the
trigger and §5 for what was deliberately left undone.

**Revised the same day:** identity became global (V19). A person is one account platform-wide, and
their roles are per store, held on a `store_memberships` row. The three roles below are
unchanged; what changed is *where they hang*.

---

## 1. The roles

| Role | Scope | Grants |
|---|---|---|
| `CUSTOMER` | one store | Cart, checkout, own orders, addresses, wishlist, writing reviews |
| `STAFF` | one store | The above, plus create/edit products, variants, categories, brands and coupons; manage orders; moderate reviews; view stats |
| `ADMIN` | one store | The above, plus **deletes** (product, category, coupon), user management, and store settings (payment, commerce, WhatsApp) |
| `PLATFORM_ADMIN` | the platform | Create, rename, re-domain and suspend stores, **and act as an ADMIN inside any of them** — products, orders, customers, settings. Appoints other operators. |

Store roles live on `store_memberships` / `store_membership_roles`; `user_roles` now holds only
platform-wide roles, i.e. `PLATFORM_ADMIN`.

**Scoping is explicit now.** One person is one account (`unique(lower(email))`) and can be an ADMIN
at Nova Sports while being an ordinary customer at Amanly — which is exactly why roles cannot live
on the user. Every authorisation decision starts by asking `StoreMembershipService.effectiveRoles`
what this person is *at the store being served*.

Two properties fall out of that and are worth stating, because both would be security bugs if they
were ever lost:

- **A store administrator acts on the membership, never on the account.** Blocking a customer
  (`active = false` on their membership) stops at that store. If it ever touched `users.status`, one
  merchant could lock a shopper out of every other merchant on the platform.
- **A store only ever sees its own members.** The admin user list queries memberships, not users, so
  a store cannot confirm whether an arbitrary email has an account elsewhere. Someone who shops on
  the platform but not here is a plain 404.

New members join automatically: an existing account signing in at a store it has never used gets a
CUSTOMER membership at that moment. It never overwrites an existing membership, so a staff member
signing in stays staff.

`CUSTOMER` is not actually asserted anywhere — customer endpoints test `isAuthenticated()`. This is
deliberate: staff should be able to shop at the store they work for.

## 2. Where it is enforced

Two layers, and both matter:

- **`SecurityConfig`** — path-level. Decides public vs authenticated, and closes everything else
  (`anyRequest().denyAll()`), so a new endpoint is shut until someone opens it.
- **`@PreAuthorize`** on controllers — role-level. `@EnableMethodSecurity` is on, so these fire.

There is no permission table and no permission check: the annotation *is* the permission.

## 3. The one rule that must not be relaxed

**Only an existing platform operator may appoint another.** `PLATFORM_ADMIN` is the boundary
between a merchant and the platform — anyone holding it can administer every store, including that
store's products, orders and customers (full access, decided 2026-08-09). A store administrator
cannot grant it however they ask.

The first operator is seeded from `app.platform.owner-email` (currently `cs.amanraj@gmail.com`):
on every start, if an account with that email exists it is granted the role. It deliberately does
**not** create the account — inventing credentials for an identity with platform-wide reach is not
something startup should do silently. Register normally, then restart.

After that, operators are appointed through `POST /api/v1/platform/admins`, which grants to an
account that already exists. Nobody may remove their own platform access: that is how a platform
ends up with no one able to administer it.

Enforced in `UserManagementServiceImpl` by two allow-lists and a guard:

- `ADMIN_CREATED_ROLES` = {STAFF, ADMIN} — what a new admin-created user may be given.
- `ADMIN_ASSIGNABLE_ROLES` = {CUSTOMER, STAFF, ADMIN} — what may be set on an existing user.
  CUSTOMER is assignable here but not at creation, because demoting a staff member is legitimate
  while creating a customer from the console is not (registration does that).
- An account that already holds `PLATFORM_ADMIN` cannot be edited through the store admin API at
  all. Roles are replaced wholesale, so editing it would silently strip the role.

> **This was a live bug, found 2026-08-09.** `createStaffOrAdmin` validated its role set;
> `changeRoles` did not. Any store admin could `PATCH /admin/users/{own-id}/roles` with
> `["ADMIN","PLATFORM_ADMIN"]` and take over the platform. The exposure existed for exactly as long
> as the role did — introduced with it in T4, whose own commit message asserted the opposite.
> `UserManagementServiceImplTest` now covers both grant paths, the protected-account rule, and the
> legitimate demotion that must keep working. **Do not remove those tests.**

## 4. Why not finer-grained permissions

The model cannot express *"handles orders but must not touch pricing"* — the only way to let someone
manage orders is STAFF, which also grants the whole catalogue. That is a real limitation and it was
accepted knowingly.

The alternatives, and what they cost:

- **Fixed job roles** (`CATALOG_MANAGER`, `ORDER_MANAGER`, `SUPPORT`) — the Stripe and GitHub model.
  A few more named roles and annotations, no schema change. The cheap next step.
- **Per-capability permissions** — the Shopify staff-permissions model: named permissions bundled
  into store-defined roles. New tables, a permission check at every endpoint, and an admin UI.

**The trigger to revisit:** the first time someone is given STAFF and told not to touch something.
At that point the access control has moved from the code into a conversation, which is where it
stops being access control.

## 5. Deliberately not built (2026-08-09)

Reviewed and deferred, not overlooked:

- **Role-change audit visibility.** `user_role_audit_logs` already records every change with the
  acting admin — and nothing reads it. "Who made Priya an admin, and when" is currently
  unanswerable without database access. The data is accumulating, so nothing is lost by waiting.
- **A roles catalogue endpoint.** An admin UI must hardcode the role list to render a picker.
- **STAFF-led user onboarding.** Only ADMIN can manage users today.

## 6. How a platform operator reaches a store

Ordinary tokens carry the store they were issued for and are refused anywhere else. A platform
operator's token is not: `JwtAuthenticationFilter` accepts it at any store, and
`StoreMembershipService` grants them ADMIN/STAFF/CUSTOMER there whether or not they are a member.
That is what lets them open a merchant's admin console to help, without being given a membership of
every store on the platform.

The cost, stated plainly because it was accepted knowingly: **one compromised platform account
exposes every merchant.** If that ever feels too broad, the narrower option is read-only inside
stores, which was offered and declined on 2026-08-09.
