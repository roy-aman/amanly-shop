import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { setSessionExpiredHandler, TokenStore } from '@/lib/http';
import * as authApi from '@/api/auth';
import * as usersApi from '@/api/users';
import type { AuthResponse, RoleName, UserResponse } from '@/lib/types';

interface AuthContextValue {
  user: UserResponse | null;
  isAuthenticated: boolean;
  isStaff: boolean; // STAFF or ADMIN — can reach the admin console
  isAdmin: boolean; // ADMIN only
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthResponse>;
  register: (email: string, fullName: string, password: string) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: UserResponse) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function hasRole(user: UserResponse | null, ...roles: RoleName[]): boolean {
  return !!user && roles.some((r) => user.roles.includes(r));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<UserResponse | null>(() => TokenStore.getUser());
  const [loading, setLoading] = useState<boolean>(TokenStore.isAuthenticated());

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

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    setUserState(res.user);
    return res;
  }, []);

  const register = useCallback(async (email: string, fullName: string, password: string) => {
    const res = await authApi.register(email, fullName, password);
    setUserState(res.user);
    return res;
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
      isStaff: hasRole(user, 'STAFF', 'ADMIN'),
      isAdmin: hasRole(user, 'ADMIN'),
      loading,
      login,
      register,
      logout,
      refreshUser,
      setUser,
    }),
    [user, loading, login, register, logout, refreshUser, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
