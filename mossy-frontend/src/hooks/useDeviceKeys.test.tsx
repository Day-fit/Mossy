import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { CryptoPair } from '../auth/deviceIdentity.ts';
import { useAuthStore } from '../store/authStore.ts';
import { useDeviceStore } from '../store/deviceStore.ts';
import { useDeviceKeys } from './useDeviceKeys.ts';

const persistence = vi.hoisted(() => ({
    loadDeviceIdentity: vi.fn(),
    loadStoredDeviceId: vi.fn(),
}));

vi.mock('../auth/deviceIdentity.ts', () => ({
    ...persistence,
    deviceDbRef: { current: null },
}));
const identity: CryptoPair = {
    type: 'Ed25519',
    public: 'public-key',
    private: 'private-key',
};

beforeEach(() => {
    vi.resetAllMocks();
    useAuthStore.setState({ isAuthenticated: false });
    useDeviceStore.setState({ deviceId: null, idKey: null });
    persistence.loadDeviceIdentity.mockResolvedValue(identity);
    persistence.loadStoredDeviceId.mockResolvedValue('device-one');
});

afterEach(cleanup);

it('restores device credentials on login, clears them on logout, and reloads them on the next login', async () => {
    renderHook(useDeviceKeys);

    expect(persistence.loadDeviceIdentity).not.toHaveBeenCalled();

    act(() => useAuthStore.setState({ isAuthenticated: true }));

    await waitFor(() =>
        expect(useDeviceStore.getState().deviceId).toBe('device-one')
    );
    expect(useDeviceStore.getState().idKey).toEqual(identity);

    act(() => useAuthStore.setState({ isAuthenticated: false }));

    expect(useDeviceStore.getState().deviceId).toBeNull();
    expect(useDeviceStore.getState().idKey).toBeNull();

    persistence.loadStoredDeviceId.mockResolvedValue('device-two');

    act(() => useAuthStore.setState({ isAuthenticated: true }));

    await waitFor(() =>
        expect(useDeviceStore.getState().deviceId).toBe('device-two')
    );
});

it('ignores a pending credential load that completes after logout', async () => {
    let finish!: (identity: CryptoPair) => void;
    persistence.loadDeviceIdentity.mockReturnValue(
        new Promise<CryptoPair>((resolve) => {
            finish = resolve;
        })
    );
    useAuthStore.setState({ isAuthenticated: true });
    renderHook(useDeviceKeys);

    act(() => useAuthStore.setState({ isAuthenticated: false }));
    await act(async () => finish(identity));

    expect(useDeviceStore.getState().deviceId).toBeNull();
    expect(useDeviceStore.getState().idKey).toBeNull();
});
