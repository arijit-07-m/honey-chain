'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { login as apiLogin, LoginResponse } from '@/lib/api';

interface AuthState {
  token: string | null;
  user: { id: number; name: string; role: string } | null;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<LoginResponse>;
  logout: () => void;
  isAuthenticated: boolean;
  isFarmer: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    user: null,
    loading: true,
  });

  useEffect(() => {
    const token = localStorage.getItem('hc_token');
    const userStr = localStorage.getItem('hc_user');
    if (token && userStr) {
      try {
        setState({ token, user: JSON.parse(userStr), loading: false });
      } catch {
        localStorage.removeItem('hc_token');
        localStorage.removeItem('hc_user');
        setState({ token: null, user: null, loading: false });
      }
    } else {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await apiLogin(email, password);
    const user = { id: response.user_id, name: response.name, role: response.role };
    localStorage.setItem('hc_token', response.access_token);
    localStorage.setItem('hc_user', JSON.stringify(user));
    setState({ token: response.access_token, user, loading: false });
    return response;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('hc_token');
    localStorage.removeItem('hc_user');
    setState({ token: null, user: null, loading: false });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        isAuthenticated: !!state.token,
        isFarmer: state.user?.role === 'FARMER',
        isAdmin: state.user?.role === 'ADMIN',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}