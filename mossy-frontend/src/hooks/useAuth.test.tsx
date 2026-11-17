import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from 'mossy-api-client/client';
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

vi.mock('mossy-api-client/tokenStorage', () => ({
    tokenStorage,
}));

vi.mock('mossy-api-client/auth.api', () => ({
    executeCheckAuthState,
    executeRefreshRequest,
    executeUserDetailsRequest,
}));

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

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

    it('refreshes an expired access token and retries the request', async () => {
        tokenStorage.set.mockImplementation((token) => {
            tokenStorage.get.mockReturnValue(token);
        });
        executeCheckAuthState.mockResolvedValue({
            json: async () => ({ isAuthenticated: true }),
        });
        executeRefreshRequest.mockResolvedValue({
            json: async () => ({ accessToken: 'fresh-token' }),
        });
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(new Response('{}', { status: 401 }))
            .mockResolvedValueOnce(new Response('{}', { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
        renderHook(useAuthInit);
        await waitFor(() => {
            expect(useAuthStore.getState().isAuthenticated).toBe(true);
        });

        await act(async () => {
            await expect(
                apiFetch('/api/v1/statistics')
            ).resolves.toHaveProperty('status', 200);
        });

        expect(executeRefreshRequest).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(
            fetchMock.mock.calls.map(
                ([, options]) => options.headers.Authorization
            )
        ).toEqual(['Bearer test-token', 'Bearer fresh-token']);
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
