import { useLayoutEffect } from 'react';

/**
 * Applies the dark palette scope for the lifetime of the calling component.
 *
 * Light is the document default (the storefront); the admin console and the
 * admin sign-in page opt into dark by calling this.
 *
 * The class MUST live on `<html>`, not on a layout wrapper: Radix portals
 * (Drawer, Modal, ConfirmDialog, DropdownMenu, Tooltip) and the toast stack
 * render into `document.body`, outside every layout subtree, so a wrapper-scoped
 * class would leave admin dropdowns and dialogs rendering on the light palette.
 *
 * `useLayoutEffect` (not `useEffect`) so the scope is applied before paint —
 * otherwise admin routes flash white on entry.
 *
 * @param enabled pass `false` to opt out (lets a shared layout stay light).
 */
export function useDarkTheme(enabled = true): void {
  useLayoutEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    root.classList.add('dark');
    return () => root.classList.remove('dark');
  }, [enabled]);
}
