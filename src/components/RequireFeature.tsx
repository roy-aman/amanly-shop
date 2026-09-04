import { Outlet } from 'react-router-dom';
import { Lock } from 'lucide-react';

import { EmptyState, LinkButton } from '@/components/ui';
import { useConsoleFeatures, useStoreFeatures, type StoreFeature } from '@/lib/features';
import NotFound from '@/pages/NotFound';
import { ListSkeleton } from '@/components/RouteSkeletons';

/**
 * Route guards for the sections a store may or may not have been granted.
 *
 * **Gate the route, not just the nav.** Hiding a link while leaving its route
 * mounted is not gating: a bookmark from before a section was withdrawn, or a
 * URL someone was sent, still lands on a page whose every request will be
 * refused. These wrappers are what makes the absence real.
 *
 * The two guards answer differently on purpose, mirroring the server:
 *
 * - **Storefront → 404.** A shop that was never granted a wishlist does not
 *   have one, in the same sense that it has no page for a product it never
 *   listed. Explaining a product tier to a customer who is not buying it would
 *   be strange, and would advertise that the shop is on a smaller plan.
 * - **Console → "not in your plan".** The merchant is being told something they
 *   can act on: the section exists, their store has not been granted it, and
 *   asking the platform team is the next step. Rendering a 404 here would send
 *   them hunting for a bug instead.
 *
 * Both wait for the answer rather than guessing. Rendering "not available"
 * while the store payload is still in flight would flash a refusal at a
 * merchant who has the section.
 */
export function RequireFeature({ feature }: { feature: StoreFeature }) {
  const { has, loading } = useStoreFeatures();

  if (loading) return <ListSkeleton />;
  return has(feature) ? <Outlet /> : <NotFound />;
}

/** Console counterpart of {@link RequireFeature}. See the note above. */
export function RequireConsoleFeature({ feature }: { feature: StoreFeature }) {
  const { has, loading } = useConsoleFeatures();

  if (loading) return <ListSkeleton />;
  return has(feature) ? <Outlet /> : <SectionNotInPlan />;
}

/**
 * What a merchant sees where a section they have not been granted would be.
 *
 * Says what it is and who can change it, and nothing else. Naming a price or
 * offering an upgrade button would be this console inventing a commercial
 * relationship it knows nothing about — the platform sells these, not the app.
 */
export function SectionNotInPlan() {
  return (
    <div className="py-16">
      <EmptyState
        icon={<Lock className="h-10 w-10" />}
        title="Not part of your plan"
        message="This section exists but your store hasn't been given it yet. Ask the platform team to switch it on — everything you've already put in it is kept, and it comes back exactly as it was."
        action={<LinkButton to="/admin">Back to dashboard</LinkButton>}
      />
    </div>
  );
}
