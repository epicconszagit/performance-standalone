import React, { createContext, useState, useContext, useEffect } from 'react';
import { apiClient, getToken, setToken } from '@/api/client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    checkUserAuth();
  }, []);

  const checkUserAuth = async () => {
    if (!getToken()) {
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      setAuthChecked(true);
      return;
    }
    try {
      setIsLoadingAuth(true);
      const currentUser = await apiClient.get('/auth/me');
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsAuthenticated(false);
      if (error.status === 401 || error.status === 403) {
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      }
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  const login = async (email, password) => {
    const result = await apiClient.post('/auth/login', { email, password });
    setToken(result.access_token);
    setUser(result.user);
    setIsAuthenticated(true);
    setAuthError(null);
    return result.user;
  };

  const register = async (email, password, details = {}) => {
    const result = await apiClient.post('/auth/register', { email, password, ...details });
    setToken(result.access_token);
    setUser(result.user);
    setIsAuthenticated(true);
    setAuthError(null);
    return result.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = '/login';
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      // Kept for compatibility with AuthenticatedApp's loading gate - this is a
      // single-tenant app now, so there's no separate "public settings" fetch.
      isLoadingPublicSettings: false,
      authError,
      authChecked,
      login,
      register,
      logout,
      navigateToLogin,
      checkUserAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
