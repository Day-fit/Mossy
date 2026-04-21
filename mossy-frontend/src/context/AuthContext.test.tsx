import { useEffect } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext.tsx';

const {
	tokenStorage,
	executeCheckAuthState,
	executeRefreshRequest,
	executeUserDetailsRequest,
} = vi.hoisted(() => ({
	tokenStorage: {
		get: vi.fn(),
		set: vi.fn(),
	},
	executeCheckAuthState: vi.fn(),
	executeRefreshRequest: vi.fn(),
	executeUserDetailsRequest: vi.fn(),
}));

vi.mock('../auth/tokenStorage.ts', () => ({
	tokenStorage,
}));

vi.mock('../api/auth.api.ts', () => ({
	executeCheckAuthState,
	executeRefreshRequest,
	executeUserDetailsRequest,
}));

describe('AuthProvider', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		tokenStorage.get.mockReturnValue('test-token');
		executeCheckAuthState.mockResolvedValue({
			json: async () => ({ isAuthenticated: false }),
		});
		executeRefreshRequest.mockResolvedValue({
			json: async () => ({ accessToken: null }),
		});
		executeUserDetailsRequest.mockResolvedValue(null);
	});

	it('renders without DeviceBootstrapProvider above it', async () => {
		render(
			<AuthProvider>
				<div>auth-ready</div>
			</AuthProvider>
		);

		await waitFor(() => {
			expect(screen.getByText('auth-ready')).toBeTruthy();
		});
	});

	it('loads user details after login sets authenticated state', async () => {
		tokenStorage.get.mockReturnValue(null);
		executeRefreshRequest.mockResolvedValue({
			json: async () => ({ accessToken: null }),
		});
		executeUserDetailsRequest.mockResolvedValue({
			userId: 'user-1',
			username: 'user',
			email: 'user@example.com',
			grantedAuthorities: [],
		});

		const LoginProbe = () => {
			const { login, userDetails } = useAuth();

			useEffect(() => {
				login('new-access-token');
			}, [login]);

			return <div>{userDetails?.userId ?? 'no-user'}</div>;
		};

		render(
			<AuthProvider>
				<LoginProbe />
			</AuthProvider>
		);

		await waitFor(() => {
			expect(executeUserDetailsRequest).toHaveBeenCalledTimes(1);
			expect(screen.getByText('user-1')).toBeTruthy();
		});
	});
});

