import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { setSessionExpiredHandler, TokenStore, type EntryPoint } from '@/lib/http';
import * as authApi from '@/api/auth';
import * as usersApi from '@/api/users';
import type { AuthResponse, LoginResult, RegisterResult, RoleName, UserResponse } from '@/lib/types';

interface AuthContextValue {
  user: UserResponse | null;
  isAuthenticated: boolean;
  /** Can reach this store's console: STAFF, ADMIN, or a platform operator. */
  isStaff: boolean;
  /** Holds the ADMIN-only powers here (users, settings, deletes) — ADMIN or a
   *  platform operator. */
  isAdmin: boolean;
  isPlatformAdmin: boolean; // PLATFORM_ADMIN — holds the role
  /**
   * Whether the platform console should be OFFERED. An operator who signed in on
   * the storefront is here for this shop, so they get this store's console only;
   * the platform door is what puts them in platform context. Routes stay guarded
   * on the role, so a deep link still works — this governs what is surfaced.
   */
  showsPlatformConsole: boolean;
  /** Which door this session was opened through. */
  signedInVia: EntryPoint;
  loading: boolean;
  /** Two-armed: `session` when signed in, `otpRequired` when a platform
   *  operator must still enter their code. Nobody is signed in on the latter. */
  login: (email: string, password: string, via?: EntryPoint) => Promise<LoginResult>;
  verifyLoginOtp: (email: string, code: string, via?: EntryPoint) => Promise<AuthResponse>;
  /** Two-armed: `session` when the account was created and signed in,
   *  `joinPending` when the address already exists elsewhere on the platform and
   *  the emailed link must be opened first. Nobody is signed in on the latter. */
  register: (email: string, fullName: string, password: string) => Promise<RegisterResult>;
  /** Second half of the `joinPending` arm: exchanges the emailed token for a session. */
  completeStoreJoin: (token: string) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: UserResponse) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function hasRole(user: UserResponse | null, ...roles: RoleName[]): boolean {
  return !!user && roles.some((r) => user.roles.includes(r));
}

/**
 * Whether this person may run the store they are signed in at.
 *
 * PLATFORM_ADMIN counts, and must. The backend grants an operator ADMIN, STAFF
 * and CUSTOMER inside *every* store — `StoreMembershipService` does this whether
 * or not they hold a membership there (roles-and-permissions.md §6) — so the API
 * will serve them every admin endpoint. A UI that tested only STAFF/ADMIN would
 * hide the console and the ADMIN-only sections from someone the server treats as
 * an administrator, which reads as a broken app rather than as a restriction.
 */
export function canManageStore(user: UserResponse | null): boolean {
  return hasRole(user, 'STAFF', 'ADMIN', 'PLATFORM_ADMIN');
}

/** Whether they hold the ADMIN-only powers: user management, store settings, and
 *  the deletes. Same reasoning as {@link canManageStore} for the operator. */
export function isStoreAdmin(user: UserResponse | null): boolean {
  return hasRole(user, 'ADMIN', 'PLATFORM_ADMIN');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<UserResponse | null>(() => TokenStore.getUser());
  const [loading, setLoading] = useState<boolean>(TokenStore.isAuthenticated());
  const [entry, setEntry] = useState<EntryPoint>(() => TokenStore.getEntryPoint());

  const clearSession = useCallback(() => {
    TokenStore.clear();
    setUserState(null);
  }, []);

  // When a token refresh ultimately fails, the http layer calls this.
  useEffect(() => {
    setSessionExpiredHandler(() => setUserState(null));
  }, []);

  // On mount, if we have a token, revalidate the user against the backend.
  useEffect(() => {
    let active = true;
    if (TokenStore.isAuthenticated()) {
      usersApi
        .getCurrentUser()
        .then((u) => active && setUserState(u))
        .catch(() => active && clearSession())
        .finally(() => active && setLoading(false));
    } else {
      setLoading(false);
    }
    return () => {
      active = false;
    };
  }, [clearSession]);

  // Returns the raw two-armed result: a 202 means the password was right but no
  // session exists yet, so the provider must NOT mark anyone as signed in until
  // the OTP step lands. Callers switch on `kind`.
  const login = useCallback(async (email: string, password: string, via: EntryPoint = 'store') => {
    const res = await authApi.login(email, password);
    if (res.kind === 'session') {
      TokenStore.setEntryPoint(via);
      setEntry(via);
      setUserState(res.auth.user);
    }
    return res;
  }, []);

  const verifyLoginOtp = useCallback(async (email: string, code: string, via: EntryPoint = 'store') => {
    const auth = await authApi.verifyLoginOtp(email, code);
    TokenStore.setEntryPoint(via);
    setEntry(via);
    setUserState(auth.user);
    return auth;
  }, []);

  // Two-armed like `login`: a 202 created nothing and issued no tokens, so nobody
  // may be marked signed in until the emailed join link is opened.
  const register = useCallback(async (email: string, fullName: string, password: string) => {
    const res = await authApi.register(email, fullName, password);
    if (res.kind === 'session') {
      // Registration is always a shopper arriving on the storefront.
      TokenStore.setEntryPoint('store');
      setEntry('store');
      setUserState(res.auth.user);
    }
    return res;
  }, []);

  // Completing a join is the second half of that 202 — it is the point a session
  // finally exists, so the entry point is stamped here rather than at register().
  const completeStoreJoin = useCallback(async (token: string) => {
    const auth = await authApi.completeStoreJoin(token);
    TokenStore.setEntryPoint('store');
    setEntry('store');
    setUserState(auth.user);
    return auth;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUserState(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const u = await usersApi.getCurrentUser();
    setUserState(u);
  }, []);

  const setUser = useCallback((u: UserResponse) => {
    TokenStore.setUser(u);
    setUserState(u);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isStaff: canManageStore(user),
      isAdmin: isStoreAdmin(user),
      isPlatformAdmin: hasRole(user, 'PLATFORM_ADMIN'),
      showsPlatformConsole: hasRole(user, 'PLATFORM_ADMIN') && entry === 'platform',
      signedInVia: entry,
      loading,
      login,
      verifyLoginOtp,
      register,
      completeStoreJoin,
      logout,
      refreshUser,
      setUser,
    }),
    [user, entry, loading, login, verifyLoginOtp, register, completeStoreJoin, logout, refreshUser, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
