import { type ReactNode, useCallback, useEffect } from 'react';
import { tokenStorage } from '../auth/tokenStorage.ts';
import {
executeCheckAuthState,
executeRefreshRequest,
executeUserDetailsRequest,
type UserDetailsResponse,
} from '../api/auth.api.ts';
import { useAuthStore } from '../store/authStore.ts';

type AuthState = {
isAuthenticated: boolean | null;
userDetails: UserDetailsResponse | null;
login: (token: string) => void;
logout: () => void;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
const setIsAuthenticated = useAuthStore((state) => state.setIsAuthenticated);
const setUserDetails = useAuthStore((state) => state.setUserDetails);

useEffect(() => {
const loadUserDetails = () => {
executeUserDetailsRequest()
.then((res) => setUserDetails(res))
.catch(() => setUserDetails(null));
};

const refreshToken = () => {
executeRefreshRequest()
.then((res) => res.json())
.then((data) => {
if (data.accessToken) {
tokenStorage.set(data.accessToken);
setIsAuthenticated(true);
loadUserDetails();
return;
}
tokenStorage.set(null);
setUserDetails(null);
setIsAuthenticated(false);
})
.catch(() => {
tokenStorage.set(null);
setUserDetails(null);
setIsAuthenticated(false);
});
};

const token = tokenStorage.get();

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
.catch(() => {
refreshToken();
});
}, [setIsAuthenticated, setUserDetails]);

return isAuthenticated !== null ? children : null;
};

export const useAuth = (): AuthState => {
const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
const userDetails = useAuthStore((state) => state.userDetails);
const setIsAuthenticated = useAuthStore((state) => state.setIsAuthenticated);
const setUserDetails = useAuthStore((state) => state.setUserDetails);

const login = useCallback(
(token: string) => {
tokenStorage.set(token);
setIsAuthenticated(true);
void executeUserDetailsRequest()
.then((res) => setUserDetails(res))
.catch(() => setUserDetails(null));
},
[setIsAuthenticated, setUserDetails]
);

const logout = useCallback(() => {
tokenStorage.set(null);
setUserDetails(null);
setIsAuthenticated(false);
}, [setIsAuthenticated, setUserDetails]);

return {
isAuthenticated,
userDetails,
login,
logout,
};
};
