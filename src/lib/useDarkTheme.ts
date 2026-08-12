import { useLayoutEffect } from 'react';
import { useOptionalTheme } from '@/context/ThemeContext';

/**
 * Holds the dark palette for the lifetime of the calling component, and marks
 * the document as a console surface (`.theme-console`, which restores the
 * console's gold primary — see index.css).
 *
 * The admin console, the platform console and the admin sign-in page call this.
 * The storefront does not: there, dark is the shopper's own choice.
 *
 * This no longer touches the class itself. It registers a claim with
 * `ThemeProvider`, which is the single writer of `dark` on <html>. That
 * indirection is the fix for a real bug: when this hook removed the class on
 * unmount, an operator who had chosen dark for the storefront was dumped back
 * into light every time they came back from /admin.
 *
 * @param enabled pass `false` to opt out (lets a shared layout stay light).
 */
export function useDarkTheme(enabled = true): void {
  const theme = useOptionalTheme();
  const acquire = theme?.acquireForcedDark;

  useLayoutEffect(() => {
    if (!enabled) return;
    if (acquire) return acquire();

    // No provider above us — a test rendering a console layout in isolation.
    // Own the class directly, exactly as this hook used to. Safe precisely
    // because without a provider there is no stored preference to clobber.
    const root = document.documentElement;
    root.classList.add('dark', 'theme-console');
    return () => root.classList.remove('dark', 'theme-console');
  }, [enabled, acquire]);
}
