'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError, getRuntimeAccessToken, setRuntimeAccessToken } from '@/lib/api';
import type { AuthUser } from '@/lib/types';

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  initialized: boolean;
  isAdmin: boolean;
  isSuper: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  switchFamily: (familyId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_SESSION_STORAGE_KEY = 'fisrtname:auth-session';
const AUTH_LOCAL_STORAGE_KEY = 'fisrtname:auth-session:persistent';

type PersistedAuthSession = {
  accessToken: string | null;
  user: AuthUser | null;
};

function readPersistedAuthSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw =
      window.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY) ??
      window.localStorage.getItem(AUTH_LOCAL_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as PersistedAuthSession;
  } catch {
    return null;
  }
}

function persistAuthSession(session: PersistedAuthSession | null) {
  if (typeof window === 'undefined') {
    return;
  }

  if (!session?.user || !session.accessToken) {
    window.sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    window.localStorage.removeItem(AUTH_LOCAL_STORAGE_KEY);
    return;
  }

  const serialized = JSON.stringify(session);
  window.sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, serialized);
  window.localStorage.setItem(AUTH_LOCAL_STORAGE_KEY, serialized);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(() => readPersistedAuthSession()?.user ?? null);
  const [initialized, setInitialized] = useState(false);

  useLayoutEffect(() => {
    const persistedSession = readPersistedAuthSession();
    if (persistedSession?.accessToken && persistedSession.user) {
      setRuntimeAccessToken(persistedSession.accessToken);
      setToken((current) => current ?? persistedSession.accessToken);
      setUser((current) => current ?? persistedSession.user);
    }
  }, []);

  useEffect(() => {
    const handleAuthCleared = () => {
      setToken(null);
      setUser(null);
      persistAuthSession(null);
    };

    const handleTokenRefreshed = (event: Event) => {
      const detail = (event as CustomEvent<{ token?: string; user?: AuthUser }>).detail;
      if (!detail?.token) {
        return;
      }

      setToken(detail.token);
      if (detail.user) {
        setUser(detail.user);
        persistAuthSession({
          accessToken: detail.token,
          user: detail.user,
        });
      }
    };

    window.addEventListener('fisrtname:auth-cleared', handleAuthCleared);
    window.addEventListener('fisrtname:token-refreshed', handleTokenRefreshed as EventListener);

    return () => {
      window.removeEventListener('fisrtname:auth-cleared', handleAuthCleared);
      window.removeEventListener(
        'fisrtname:token-refreshed',
        handleTokenRefreshed as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrapSession = async () => {
      try {
        const nextSession = await api.refresh();
        if (cancelled) {
          return;
        }

        setToken(nextSession.accessToken);
        setUser(nextSession.user);
        persistAuthSession({
          accessToken: nextSession.accessToken,
          user: nextSession.user,
        });
      } catch {
        if (cancelled) {
          return;
        }

        setRuntimeAccessToken(null);
        setToken(null);
        setUser(null);
        persistAuthSession(null);
      } finally {
        if (!cancelled) {
          setInitialized(true);
        }
      }
    };

    void bootstrapSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback((nextToken: string, nextUser: AuthUser) => {
    setRuntimeAccessToken(nextToken);
    setToken(nextToken);
    setUser(nextUser);
    persistAuthSession({
      accessToken: nextToken,
      user: nextUser,
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // ignore logout failure
    } finally {
      setRuntimeAccessToken(null);
      setToken(null);
      setUser(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const nextUser = await api.me();
      setUser(nextUser);
      persistAuthSession({
        accessToken: getRuntimeAccessToken(),
        user: nextUser,
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await logout();
      }
    }
  }, [logout]);

  const switchFamily = useCallback(async (familyId: string) => {
    const nextSession = await api.switchFamily(familyId);
    setRuntimeAccessToken(nextSession.accessToken);
    setToken(nextSession.accessToken);
    setUser(nextSession.user);
    persistAuthSession({
      accessToken: nextSession.accessToken,
      user: nextSession.user,
    });
    await Promise.all([
      queryClient.invalidateQueries(),
      queryClient.refetchQueries({ type: 'active' }),
    ]);
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      initialized,
      isAdmin: user?.role === 'ADMIN',
      isSuper: user?.platformRole === 'SUPER',
      login,
      logout,
      refreshProfile,
      switchFamily,
    }),
    [initialized, login, logout, refreshProfile, switchFamily, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth 必须在 AuthProvider 内部使用');
  }

  return context;
}
