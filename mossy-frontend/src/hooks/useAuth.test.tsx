import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../store/authStore.ts';
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

afterEach(cleanup);

describe('useAuth / useAuthInit', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        useAuthStore.setState({ isAuthenticated: null, userDetails: null });
        tokenStorage.get.mockReturnValue('test-token');
        executeCheckAuthState.mockResolvedValue({
            json: async () => ({ isAuthenticated: false }),
        });
        executeRefreshRequest.mockResolvedValue({
            json: async () => ({ accessToken: null }),
        });
        executeUserDetailsRequest.mockResolvedValue(null);
    });

    it('resolves authentication state after initialization', async () => {
        renderHook(useAuthInit);
        await waitFor(() => {
            expect(useAuthStore.getState().isAuthenticated).toBe(false);
        });
    });

    it('loads user details after login sets authenticated state', async () => {
        executeUserDetailsRequest.mockResolvedValue({
            userId: 'user-1',
            username: 'user',
            email: 'user@example.com',
            grantedAuthorities: [],
        });

        const { result } = renderHook(useAuth);
        act(() => result.current.login('new-access-token'));

        await waitFor(() => {
            expect(result.current.userDetails?.userId).toBe('user-1');
        });
        expect(result.current.isAuthenticated).toBe(true);
        expect(tokenStorage.set).toHaveBeenCalledWith('new-access-token');
        expect(executeUserDetailsRequest).toHaveBeenCalledTimes(1);
    });
});
