import { createContext, useContext, useState, type ReactNode } from 'react';

import { login as apiLogin, type AuthUser } from '../api/auth';

const TOKEN_STORAGE_KEY = 'elno-admin-token';
const USER_STORAGE_KEY = 'elno-admin-user';

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  status: 'idle' | 'loading' | 'authenticated' | 'error';
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Unlike the mobile app (token held in-memory only, by design — see its
 * authStore.ts), this persists to localStorage: a browser tab commonly
 * gets refreshed or reopened, and re-typing a password every time that
 * happens would be real friction for a desk tool used repeatedly
 * through a workday. The tradeoff (XSS could read localStorage) is
 * accepted here since this is an internal admin tool, not a public app.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  });
  const [status, setStatus] = useState<AuthContextValue['status']>(token ? 'authenticated' : 'idle');
  const [error, setError] = useState<string | null>(null);

  async function login(email: string, password: string) {
    setStatus('loading');
    setError(null);
    try {
      const response = await apiLogin(email, password);
      // This dashboard's whole feature set (reference lists, bulk
      // instructions, bulk photo download) is Admin-only on the
      // backend anyway — rejecting other roles here gives a clear
      // message instead of a confusing wall of 403s once inside.
      if (response.user.role !== 'admin') {
        throw new Error('This dashboard is for Admin accounts only.');
      }
      setToken(response.accessToken);
      setUser(response.user);
      localStorage.setItem(TOKEN_STORAGE_KEY, response.accessToken);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.user));
      setStatus('authenticated');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setStatus('error');
      setError(message);
      throw err;
    }
  }

  function logout() {
    setToken(null);
    setUser(null);
    setStatus('idle');
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  }

  return <AuthContext.Provider value={{ token, user, status, error, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
