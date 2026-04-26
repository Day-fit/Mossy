import { useEffect } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from './useAuth.ts';
import { useAuthInit } from './useAuthInit.ts';

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

function AuthInitWrapper({ children }: { children: React.ReactNode }) {
	useAuthInit();
	const { isAuthenticated } = useAuth();
	return isAuthenticated !== null ? children : null;
}

describe('useAuth / useAuthInit', () => {
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

	it('renders children after auth init resolves', async () => {
		render(
			<AuthInitWrapper>
				<div>auth-ready</div>
			</AuthInitWrapper>
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
			<AuthInitWrapper>
				<LoginProbe />
			</AuthInitWrapper>
		);

		await waitFor(() => {
			expect(executeUserDetailsRequest).toHaveBeenCalledTimes(1);
			expect(screen.getByText('user-1')).toBeTruthy();
		});
	});
});
