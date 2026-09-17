import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeviceSync } from './useDeviceSync.ts';

const {
    executeGetDeviceIdentityKeyRequest,
    executeInitKeySyncRequest,
    deviceKeyStateRef,
} = vi.hoisted(() => ({
    executeGetDeviceIdentityKeyRequest: vi.fn(),
    executeInitKeySyncRequest: vi.fn(),
    deviceKeyStateRef: {
        current: {
            deviceId: 'device-1' as string | null,
        },
    },
}));

vi.mock('../api/device.api.ts', () => ({
    executeGetDeviceIdentityKeyRequest,
    executeInitKeySyncRequest,
}));

vi.mock('../store/deviceStore.ts', () => ({
    useDeviceStore: (
        selector: (state: { deviceId: string | null }) => unknown
    ) => selector({ deviceId: deviceKeyStateRef.current.deviceId }),
}));

vi.mock('./useDeviceKeys.ts', () => ({
    useDeviceKeys: () => ({
        generateDhKey: vi.fn(),
        idKey: null,
    }),
}));

vi.mock('./useEncryptionHook.ts', () => ({
    useEncryptionHook: () => ({
        loadKey: vi.fn(),
        saveRawKey: vi.fn(),
    }),
}));

describe('useDeviceSync', () => {
    afterEach(() => {
        cleanup();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        deviceKeyStateRef.current = { deviceId: 'device-1' };
        executeInitKeySyncRequest.mockResolvedValue({ code: 'ABC123' });
    });

    it('initializes key sync when deviceId is present', async () => {
        const { result } = renderHook(useDeviceSync);
        await expect(result.current.initializeKeySync('vault-1')).resolves.toBe(
            'ABC123'
        );
        expect(executeInitKeySyncRequest).toHaveBeenCalledWith('vault-1');
    });

    it('does not initialize key sync when deviceId is missing', async () => {
        deviceKeyStateRef.current.deviceId = null;
        const { result } = renderHook(useDeviceSync);
        await expect(
            result.current.initializeKeySync('vault-1')
        ).rejects.toThrow('Device ID not found');
        expect(executeInitKeySyncRequest).not.toHaveBeenCalled();
    });
});
