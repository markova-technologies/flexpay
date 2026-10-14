import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);

const TOKEN_KEY = 'flexpay_auth_token';
const USER_KEY = 'flexpay_auth_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Parse JWT payload safely without external library
  const parseJwt = (t) => {
    try {
      const base64Url = t.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  };

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      const savedUser = localStorage.getItem(USER_KEY);

      if (savedToken && savedUser) {
        const payload = parseJwt(savedToken);
        const now = Math.floor(Date.now() / 1000);

        if (payload && (!payload.exp || payload.exp > now)) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        } else {
          // Token expired
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
        }
      }
    } catch (e) {
      console.warn('Failed to restore auth session:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email, pin) => {
    const res = await api.login({ email, pin });
    if (res.token && res.user) {
      localStorage.setItem(TOKEN_KEY, res.token);
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
      setToken(res.token);
      setUser(res.user);
      return res.user;
    }
    throw new Error('Invalid login response from server');
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout().catch(() => {});
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setToken(null);
      setUser(null);
    }
  }, []);

  // Quick switch to any demo persona during live hackathon demonstrations
  const switchDemoUser = useCallback(async (demoUser, pin = '1234') => {
    try {
      let resolvedPin = pin;
      if (demoUser.role === 'EMPLOYER_ADMIN') resolvedPin = '5678';
      if (demoUser.role === 'MERCHANT') resolvedPin = '9012';
      if (demoUser.role === 'FLEXPAY_ADMIN') resolvedPin = '0000';
      if (demoUser.demoPin) resolvedPin = demoUser.demoPin;

      return await login(demoUser.email, resolvedPin);
    } catch (err) {
      console.error('Demo user switch failed:', err);
      // Fallback local setting for offline demo resilience
      const fallbackUser = {
        userId: demoUser.id,
        email: demoUser.email,
        role: demoUser.role,
        entityId: demoUser.entity_id || demoUser.entityId,
        name: demoUser.name,
      };
      const dummyToken = 'demo-offline-token';
      localStorage.setItem(TOKEN_KEY, dummyToken);
      localStorage.setItem(USER_KEY, JSON.stringify(fallbackUser));
      setToken(dummyToken);
      setUser(fallbackUser);
      return fallbackUser;
    }
  }, [login]);

  const value = {
    user,
    token,
    isAuthenticated: Boolean(user && token),
    isLoading,
    login,
    logout,
    switchDemoUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
