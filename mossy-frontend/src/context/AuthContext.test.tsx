import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './AuthContext.tsx';

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
});

