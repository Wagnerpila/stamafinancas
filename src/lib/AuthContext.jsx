import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '@/api/entities';
import { getToken, setToken, onUnauthorized } from '@/api/apiClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setIsLoadingAuth(false);
      return null;
    }
    try {
      const current = await User.me();
      setUser(current);
      return current;
    } catch {
      setToken(null);
      setUser(null);
      return null;
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // If any API call comes back 401 (expired/invalid session), drop back to the login screen.
  useEffect(() => {
    onUnauthorized(() => setUser(null));
  }, []);

  const login = async (email, password) => {
    const loggedInUser = await User.login(email, password);
    setUser(loggedInUser);
    return loggedInUser;
  };

  const register = async (payload) => {
    const newUser = await User.register(payload);
    setUser(newUser);
    return newUser;
  };

  const logout = () => {
    User.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoadingAuth,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
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
