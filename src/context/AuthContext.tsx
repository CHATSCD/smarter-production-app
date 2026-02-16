'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthUser } from '@/types/scheduling';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null, token: null, loading: true,
  login: async () => ({}),
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('keiths_auth_token');
    if (stored) {
      setToken(stored);
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${stored}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.user) setUser(data.user);
          else { localStorage.removeItem('keiths_auth_token'); setToken(null); }
        })
        .catch(() => { localStorage.removeItem('keiths_auth_token'); setToken(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || 'Login failed' };
      localStorage.setItem('keiths_auth_token', data.token);
      setToken(data.token);
      setUser(data.user);
      return {};
    } catch {
      return { error: 'Unable to connect. Please try again.' };
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('keiths_auth_token');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
