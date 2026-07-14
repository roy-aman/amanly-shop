import { Compass } from 'lucide-react';
import { EmptyState, LinkButton } from '@/components/ui';
import { useDocumentTitle } from '@/lib/useDocumentTitle';

/**
 * Branded 404 used for unmatched routes in both the storefront (`*` under
 * StoreLayout — also the global fallback) and the admin console (`*` under
 * AdminLayout). It renders inside whichever layout matched, so the surrounding
 * chrome (header/nav) stays intact. Admin passes a dashboard-relative home link.
 */
export default function NotFound({
  homeTo = '/',
  homeLabel = 'Back to home',
}: {
  homeTo?: string;
  homeLabel?: string;
} = {}) {
  useDocumentTitle('Page not found');
  return (
    <div className="py-16">
      <EmptyState
        icon={<Compass className="h-10 w-10" />}
        title="Page not found"
        message="The page you're looking for doesn't exist or has moved."
        action={<LinkButton to={homeTo}>{homeLabel}</LinkButton>}
      />
    </div>
  );
}
