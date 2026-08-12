import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme, THEME_STORAGE_KEY } from './ThemeContext';
import { useDarkTheme } from '@/lib/useDarkTheme';

/**
 * jsdom ships no `matchMedia`. Everything here that depends on the OS setting
 * would otherwise silently take the "no media query support" fallback and pass
 * for the wrong reason, so the stub is installed per test and is controllable.
 */
let systemDark = false;
const listeners = new Set<(e: MediaQueryListEvent) => void>();

function installMatchMedia() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('dark') && systemDark,
      media: query,
      addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.delete(fn),
    })),
  );
}

/** Simulate the OS flipping to dark while the page is open. */
function flipSystemTo(dark: boolean) {
  systemDark = dark;
  act(() => {
    listeners.forEach((fn) => fn({ matches: dark } as MediaQueryListEvent));
  });
}

const html = () => document.documentElement;
const isDark = () => html().classList.contains('dark');
const isConsole = () => html().classList.contains('theme-console');

/** Minimal storefront surface: shows the resolved theme and can change it. */
function Storefront() {
  const { preference, resolved, setPreference, forcedByConsole } = useTheme();
  return (
    <div>
      <span data-testid="resolved">{resolved}</span>
      <span data-testid="preference">{preference}</span>
      <span data-testid="forced">{String(forcedByConsole)}</span>
      <button onClick={() => setPreference('dark')}>Dark</button>
      <button onClick={() => setPreference('light')}>Light</button>
      <button onClick={() => setPreference('system')}>System</button>
    </div>
  );
}

/** Stands in for AdminLayout / PlatformLayout, which hold dark while mounted. */
function Console() {
  useDarkTheme();
  return <p>console</p>;
}

beforeEach(() => {
  systemDark = false;
  listeners.clear();
  localStorage.clear();
  html().className = '';
  installMatchMedia();
});

afterEach(() => {
  vi.unstubAllGlobals();
  html().className = '';
});

describe('Theme preference', () => {
  it('follows the operating system when nothing has been chosen', () => {
    systemDark = true;
    render(
      <ThemeProvider>
        <Storefront />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('preference')).toHaveTextContent('system');
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
    expect(isDark()).toBe(true);
  });

  it('restores a previously stored choice over the OS setting', () => {
    systemDark = true;
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    render(
      <ThemeProvider>
        <Storefront />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('resolved')).toHaveTextContent('light');
    expect(isDark()).toBe(false);
  });

  it('applies and persists an explicit choice', async () => {
    const u = userEvent.setup();
    render(
      <ThemeProvider>
        <Storefront />
      </ThemeProvider>,
    );

    await u.click(screen.getByRole('button', { name: 'Dark' }));

    expect(isDark()).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('keeps following the OS after it changes, while set to system', async () => {
    render(
      <ThemeProvider>
        <Storefront />
      </ThemeProvider>,
    );
    expect(isDark()).toBe(false);

    flipSystemTo(true);

    expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
    expect(isDark()).toBe(true);
  });

  it('ignores the OS once a choice has been made', async () => {
    const u = userEvent.setup();
    render(
      <ThemeProvider>
        <Storefront />
      </ThemeProvider>,
    );
    await u.click(screen.getByRole('button', { name: 'Light' }));

    flipSystemTo(true);

    expect(screen.getByTestId('resolved')).toHaveTextContent('light');
    expect(isDark()).toBe(false);
  });

  it('still renders when storage is unavailable', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(
      <ThemeProvider>
        <Storefront />
      </ThemeProvider>,
    );
    // A private-mode browser must not take the page down; it just can't persist.
    expect(screen.getByTestId('preference')).toHaveTextContent('system');
    spy.mockRestore();
  });
});

describe('Console routes holding dark', () => {
  it('forces dark and marks the document as a console surface', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    render(
      <ThemeProvider>
        <Storefront />
        <Console />
      </ThemeProvider>,
    );

    expect(isDark()).toBe(true);
    expect(isConsole()).toBe(true);
    expect(screen.getByTestId('forced')).toHaveTextContent('true');
  });

  /**
   * The regression this whole context exists to prevent.
   *
   * `useDarkTheme` used to add `dark` on mount and remove it on unmount, which
   * was fine while dark meant "console". Once a shopper can choose dark, that
   * cleanup silently reverts their choice on the way out of /admin.
   */
  it('restores the shopper’s dark choice when leaving, instead of dropping to light', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const { rerender } = render(
      <ThemeProvider>
        <Storefront />
        <Console />
      </ThemeProvider>,
    );
    expect(isDark()).toBe(true);

    // Navigate away from the console.
    rerender(
      <ThemeProvider>
        <Storefront />
      </ThemeProvider>,
    );

    expect(isDark()).toBe(true);
    expect(isConsole()).toBe(false);
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
  });

  it('returns to light on leaving when that is what the shopper chose', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    const { rerender } = render(
      <ThemeProvider>
        <Storefront />
        <Console />
      </ThemeProvider>,
    );
    expect(isDark()).toBe(true);

    rerender(
      <ThemeProvider>
        <Storefront />
      </ThemeProvider>,
    );

    expect(isDark()).toBe(false);
    expect(isConsole()).toBe(false);
  });

  /**
   * `theme-console` is what restores the console's gold primary and its ambient
   * gold wash. A storefront in dark must never carry it, or the shop inherits
   * the dashboard's accent.
   */
  it('never marks a storefront in dark mode as a console', async () => {
    const u = userEvent.setup();
    render(
      <ThemeProvider>
        <Storefront />
      </ThemeProvider>,
    );
    await u.click(screen.getByRole('button', { name: 'Dark' }));

    expect(isDark()).toBe(true);
    expect(isConsole()).toBe(false);
  });

  it('holds dark until the last of several nested console layouts releases', () => {
    const { rerender } = render(
      <ThemeProvider>
        <Storefront />
        <Console />
        <Console />
      </ThemeProvider>,
    );
    expect(isDark()).toBe(true);

    // One releases; the other is still mounted and still needs dark.
    rerender(
      <ThemeProvider>
        <Storefront />
        <Console />
      </ThemeProvider>,
    );
    expect(isDark()).toBe(true);

    rerender(
      <ThemeProvider>
        <Storefront />
      </ThemeProvider>,
    );
    expect(isDark()).toBe(false);
  });
});
