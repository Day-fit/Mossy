import { useCallback } from 'react';
import { tokenStorage } from '../auth/tokenStorage';
import { executeUserDetailsRequest } from '../api/auth.api';
import { useAuthStore } from '../store/authStore';

export const useAuth = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userDetails = useAuthStore((state) => state.userDetails);
  const setIsAuthenticated = useAuthStore((state) => state.setIsAuthenticated);
  const setUserDetails = useAuthStore((state) => state.setUserDetails);

  const login = useCallback(
    async (token: string) => {
      await tokenStorage.set(token);
      setIsAuthenticated(true);
      void executeUserDetailsRequest().then(setUserDetails).catch(() => setUserDetails(null));
    },
    [setIsAuthenticated, setUserDetails]
  );

  const logout = useCallback(async () => {
    await tokenStorage.set(null);
    setUserDetails(null);
    setIsAuthenticated(false);
  }, [setIsAuthenticated, setUserDetails]);

  return { isAuthenticated, userDetails, login, logout };
};
