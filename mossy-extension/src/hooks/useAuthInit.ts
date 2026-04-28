import { useEffect } from 'react';
import { tokenStorage } from '../auth/tokenStorage';
import { executeCheckAuthState, executeRefreshRequest, executeUserDetailsRequest } from '../api/auth.api';
import { useAuthStore } from '../store/authStore';

export const useAuthInit = () => {
  const setIsAuthenticated = useAuthStore((state) => state.setIsAuthenticated);
  const setUserDetails = useAuthStore((state) => state.setUserDetails);

  useEffect(() => {
    const loadUserDetails = () => {
      executeUserDetailsRequest().then(setUserDetails).catch(() => setUserDetails(null));
    };

    const refreshToken = () => {
      executeRefreshRequest()
        .then((res) => res.json())
        .then(async (data) => {
          if (data.accessToken) {
            await tokenStorage.set(data.accessToken);
            setIsAuthenticated(true);
            loadUserDetails();
            return;
          }
          await tokenStorage.set(null);
          setUserDetails(null);
          setIsAuthenticated(false);
        })
        .catch(async () => {
          await tokenStorage.set(null);
          setUserDetails(null);
          setIsAuthenticated(false);
        });
    };

    void (async () => {
      const token = await tokenStorage.get();

      if (token === null) {
        refreshToken();
        return;
      }

      executeCheckAuthState({ token })
        .then((res) => res.json())
        .then((data) => {
          const authenticated = data.isAuthenticated === true;
          setIsAuthenticated(authenticated);
          if (authenticated) {
            loadUserDetails();
          } else {
            setUserDetails(null);
          }
        })
        .catch(refreshToken);
    })();
  }, [setIsAuthenticated, setUserDetails]);
};
