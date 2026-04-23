import { create } from 'zustand';
import type { UserDetailsResponse } from '../api/auth.api.ts';

type AuthStoreState = {
	isAuthenticated: boolean | null;
	userDetails: UserDetailsResponse | null;
	setIsAuthenticated: (value: boolean | null) => void;
	setUserDetails: (value: UserDetailsResponse | null) => void;
};

export const useAuthStore = create<AuthStoreState>((set) => ({
	isAuthenticated: null,
	userDetails: null,
	setIsAuthenticated: (value) => set({ isAuthenticated: value }),
	setUserDetails: (value) => set({ userDetails: value }),
}));
