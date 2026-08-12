import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * Theme ownership for the whole document.
 *
 * There is exactly ONE place that writes the `dark` class onto <html>: the
 * effect in this provider. That is the entire point of the file.
 *
 * Before this, `useDarkTheme` added the class on mount and removed it on
 * unmount, which was correct while dark meant "the admin console". Once a
 * shopper can *choose* dark for the storefront, that model silently breaks:
 * visiting /admin and coming back would run the console's cleanup and strip the
 * class, dropping the shopper back to light with no way to explain why. So the
 * console no longer toggles anything — it registers a claim, and this provider
 * resolves every claim plus the stored preference into one answer.
 */

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/** Also read by the no-flash bootstrap in index.html — change both together. */
export const THEME_STORAGE_KEY = 'rc_theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Marks the document as a console surface; see `.dark.theme-console` in index.css. */
const CONSOLE_CLASS = 'theme-console';

export function readStoredPreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    // Storage blocked (private mode, embedded webview). Following the OS is a
    // fine answer — the only thing lost is that the choice won't persist.
  }
  return 'system';
}

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia(DARK_QUERY).matches;
  } catch {
    return false;
  }
}

interface ThemeValue {
  /** What the shopper asked for. `system` follows the OS. */
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /** What is actually on screen, after the OS and any console claim. */
  resolved: ResolvedTheme;
  /** True while a console route is holding dark, which makes the picker moot. */
  forcedByConsole: boolean;
  /** Console layouts claim dark while mounted; the returned fn releases it. */
  acquireForcedDark: () => () => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  // A count, not a boolean: nested console layouts (PlatformLayout inside a
  // route that also forces dark) must each release independently, and React
  // StrictMode mounts effects twice in development.
  const [consoleClaims, setConsoleClaims] = useState(0);

  // Follow the OS live. Someone whose machine flips to dark at sunset should
  // see this page follow without a reload.
  useEffect(() => {
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia(DARK_QUERY);
    } catch {
      return;
    }
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const forcedByConsole = consoleClaims > 0;
  const chosen: ResolvedTheme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
  const resolved: ResolvedTheme = forcedByConsole ? 'dark' : chosen;

  // Layout effect, not effect: the class must be on <html> before paint or
  // entering a console route flashes the light palette first.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    root.classList.toggle(CONSOLE_CLASS, forcedByConsole);
  }, [resolved, forcedByConsole]);

  // Keeps the mobile browser chrome (Safari/Chrome address bar) in step with
  // the page instead of leaving a white bar above a dark document.
  useEffect(() => {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', resolved === 'dark' ? '#111111' : '#ffffff');
  }, [resolved]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Unpersisted, but honoured for this session.
    }
  }, []);

  const acquireForcedDark = useCallback(() => {
    setConsoleClaims((n) => n + 1);
    return () => setConsoleClaims((n) => n - 1);
  }, []);

  const value = useMemo(
    () => ({ preference, setPreference, resolved, forcedByConsole, acquireForcedDark }),
    [preference, setPreference, resolved, forcedByConsole, acquireForcedDark],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

/**
 * For `useDarkTheme`, which runs in layouts that a test may render on their own.
 * Returns null rather than throwing so that path can fall back.
 */
export function useOptionalTheme(): ThemeValue | null {
  return useContext(ThemeContext);
}
