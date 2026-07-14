import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { BUTTON_SIZES, BUTTON_VARIANTS, Button, EmptyState, cn } from '@/components/ui';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Branded full-page fallback for uncaught render errors (the "500" surface).
 *
 * Actions deliberately use a hard `window.location.reload()` and a plain
 * `<a href="/">` rather than SPA navigation: when React's tree has already
 * thrown, a soft route change can re-trigger the same broken render, whereas a
 * full document load resets all state. This screen therefore does NOT depend on
 * Router context.
 */
function ErrorScreen({ onReload }: { onReload: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg">
        <EmptyState
          icon={<AlertTriangle className="h-10 w-10 text-danger-400" />}
          title="Something went wrong"
          message="An unexpected error interrupted the page. Reloading usually fixes it — if it keeps happening, head back home."
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button onClick={onReload}>Reload page</Button>
              <a
                href="/"
                className={cn(
                  'inline-flex items-center justify-center gap-2 rounded-lg transition',
                  BUTTON_VARIANTS.secondary,
                  BUTTON_SIZES.md,
                )}
              >
                Go home
              </a>
            </div>
          }
        />
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface for local debugging; a real error tracker (Sentry) lands in WP-7.5.
    console.error('Uncaught render error:', error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.error) {
      return <ErrorScreen onReload={this.handleReload} />;
    }
    return this.props.children;
  }
}
