import { useAuthStore } from '../store/authStore.ts';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { receiveVaultKey } from '../key-sync/receiveVaultKey.ts';
import { useDeviceStore } from '../store/deviceStore.ts';
import { useEncryptionStore } from '../store/encryptionStore.ts';
import { useKeySyncReceiver } from './useKeySyncReceiver.ts';
import type { VaultKeyProtection } from '../types/vaultKey.ts';

const encryption = vi.hoisted(() => ({ saveRawKey: vi.fn() }));

vi.mock('../storage/vaultKeys.ts', () => ({
    keyStorage: encryption,
}));

vi.mock('../key-sync/receiveVaultKey.ts', () => ({ receiveVaultKey: vi.fn() }));

describe('receiver lifecycle', () => {
    const protection: VaultKeyProtection = {
        userId: 'user-one',
        passkey: new TextEncoder().encode('a vault password'),
        metadata: {
            type: 'PRF',
            credentialId: 'Y3JlZA',
            prfSalt: new Uint8Array(32),
        },
    };
    const attempts: Parameters<typeof receiveVaultKey>[0][] = [];

    beforeEach(() => {
        useAuthStore.setState({
            isAuthenticated: true,
            userDetails: {
                userId: 'user-one',
                email: 'one@example.test',
                username: 'One',
                grantedAuthorities: [],
            },
        });

        vi.resetAllMocks();
        attempts.length = 0;
        useEncryptionStore.setState({ passkeys: {} });
        useDeviceStore.setState({
            deviceId: 'receiver-device',
            idKey: { type: 'Ed25519', public: 'public', private: 'private' },
        });
        vi.mocked(receiveVaultKey).mockImplementation((options) => {
            attempts.push(options);
            return new Promise((_resolve, reject) =>
                options.signal.addEventListener(
                    'abort',
                    () => reject(options.signal.reason),
                    { once: true }
                )
            );
        });
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    it('aborts the receiver session when its modal unmounts', () => {
        const { unmount } = renderHook(() =>
            useKeySyncReceiver('vault-one', protection)
        );

        expect(attempts).toHaveLength(1);

        unmount();

        expect(attempts[0].signal.aborted).toBe(true);
    });

    it('saves received keys with Text metadata and keeps the encoded passkey in memory', async () => {
        renderHook(() => useKeySyncReceiver('vault-one', protection));
        const key = new Uint8Array(32).fill(42);

        await act(async () => attempts[0].saveKey(key));

        const { passkey } = protection;

        expect(encryption.saveRawKey).toHaveBeenCalledWith(
            'vault-one',
            passkey,
            key,
            { type: 'PRF', credentialId: 'Y3JlZA', prfSalt: new Uint8Array(32) }
        );
        expect(useEncryptionStore.getState().getPasskey('vault-one')).toEqual(
            passkey
        );
    });

    it('keeps the receiver connection open when device identity is reloaded with the same keys', () => {
        renderHook(() => useKeySyncReceiver('vault-one', protection));

        act(() =>
            useDeviceStore.setState({
                idKey: { ...useDeviceStore.getState().idKey! },
            })
        );

        expect(attempts).toHaveLength(1);
        expect(attempts[0].signal.aborted).toBe(false);
    });

    it('replaces the receiver connection when the actual device identity changes', () => {
        renderHook(() => useKeySyncReceiver('vault-one', protection));

        act(() =>
            useDeviceStore.setState({
                idKey: {
                    type: 'Ed25519',
                    public: 'new-public',
                    private: 'new-private',
                },
            })
        );

        expect(attempts).toHaveLength(2);
        expect(attempts[0].signal.aborted).toBe(true);
        expect(attempts[1].signal.aborted).toBe(false);
    });

    it('ends a stalled transfer and gives the receiver a retryable timeout error', async () => {
        vi.useFakeTimers();
        const { result } = renderHook(() =>
            useKeySyncReceiver('vault-one', protection)
        );

        await act(async () => {
            await vi.advanceTimersByTimeAsync(5 * 60_000);
        });

        expect(attempts[0].signal.aborted).toBe(true);
        expect(result.current.phase).toBe('error');
        expect(result.current.error).toContain('timed out');
    });

    it('keeps the new code when callbacks arrive from an abandoned attempt', async () => {
        let oldOptions!: Parameters<typeof receiveVaultKey>[0];
        vi.mocked(receiveVaultKey).mockImplementationOnce(async (options) => {
            oldOptions = options;
            throw new Error('Connection lost');
        });
        const { result } = renderHook(() =>
            useKeySyncReceiver('vault-one', protection)
        );

        await waitFor(() => expect(result.current.phase).toBe('error'));

        act(() => result.current.retry());
        act(() => attempts[0].onCode('XYZ789'));
        act(() => oldOptions.onCode('ABC123'));

        expect(oldOptions.signal.aborted).toBe(true);
        expect(result.current.code).toBe('XYZ789');
        expect(result.current.phase).toBe('waiting');
    });
    it('aborts sync and rejects late keys when the signed-in account changes', async () => {
        renderHook(() => useKeySyncReceiver('vault-one', protection));
        act(() =>
            useAuthStore.setState({
                userDetails: {
                    ...useAuthStore.getState().userDetails!,
                    userId: 'user-two',
                },
            })
        );
        expect(attempts[0].signal.aborted).toBe(true);
        expect(attempts).toHaveLength(1);
        await expect(
            attempts[0].saveKey(new Uint8Array(32))
        ).rejects.toMatchObject({ name: 'AbortError' });
        expect(encryption.saveRawKey).not.toHaveBeenCalled();
    });
});
