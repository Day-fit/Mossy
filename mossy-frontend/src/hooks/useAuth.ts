import { useCallback } from 'react';
import { tokenStorage } from '../auth/tokenStorage.ts';
import {
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

export const useAuth = (): AuthState => {
	const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
	const userDetails = useAuthStore((state) => state.userDetails);
	const setIsAuthenticated = useAuthStore(
		(state) => state.setIsAuthenticated
	);
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
