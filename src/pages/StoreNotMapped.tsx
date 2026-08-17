import { Unplug } from 'lucide-react';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { API_BASE_URL } from '@/lib/http';

/**
 * Shown when the backend answers that this address is attached to no store.
 *
 * It replaces the whole app rather than rendering inside a layout, because there is no store to
 * draw the chrome from: no name, no navigation, no catalogue. Everything below it would be the
 * empty shell of a shop that does not exist.
 *
 * The alternative — and what happened before the backend learned to say this — was that an
 * unrecognised address was quietly served some *other* store's catalogue with a 200, so a
 * misconfigured shop looked like a working one selling the wrong things.
 */
export default function StoreNotMapped() {
  useDocumentTitle('Store not configured');
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-950 px-6 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-ink-900 text-slate-500">
          <Unplug className="h-8 w-8" />
        </div>
        <h1 className="text-h3 text-slate-100">This address has no store</h1>
        <p className="mt-3 text-body-sm leading-relaxed text-slate-400">
          Nobody has attached <span className="font-medium text-slate-200">{window.location.host}</span> to a
          store yet, so there is nothing to show here. If you are the operator, add this address to the store
          in the platform console.
        </p>
        {/* The API origin is the likeliest thing to be wrong when this appears in an environment
            that worked a moment ago, and it is otherwise invisible — it is baked into the bundle at
            build time, so it cannot be checked from the running page. */}
        <p className="mt-8 text-caption text-slate-500">API: {API_BASE_URL || 'same origin'}</p>
      </div>
    </main>
  );
}
