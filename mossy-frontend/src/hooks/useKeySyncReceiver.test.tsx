import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { receiveVaultKey } from '../key-sync/receiveVaultKey.ts';
import type { CryptoPair } from '../auth/deviceIdentity.ts';
import { useDeviceStore } from '../store/deviceStore.ts';
import { useKeySyncReceiver } from './useKeySyncReceiver.ts';
import type { PreparedProtection } from './useEncryptionHook.ts';

const encryption = vi.hoisted(() => ({ saveRawKey: vi.fn() }));
vi.mock('./useEncryptionHook.ts', () => ({
    useEncryptionHook: () => encryption,
}));
vi.mock('../key-sync/receiveVaultKey.ts', () => ({ receiveVaultKey: vi.fn() }));

describe('receiver lifecycle', () => {
    type ReceiverAttempt = {
        signal: AbortSignal;
        onCode: (code: string) => void;
    };
    const attempts: ReceiverAttempt[] = [];
    const identity: CryptoPair = {
        type: 'Ed25519',
        public: 'public',
        privateKey: { type: 'private', extractable: false, algorithm: { name: 'Ed25519' }, usages: ['sign'] },
    };
    beforeEach(() => {
        vi.resetAllMocks();
        attempts.length = 0;
        useDeviceStore.setState({
            deviceId: 'receiver-device',
            idKey: identity,
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
            useKeySyncReceiver('vault-one')
        );
        expect(attempts).toHaveLength(1);

        unmount();

        expect(attempts[0].signal.aborted).toBe(true);
    });

    it('keeps the receiver connection open when device identity is reloaded with the same keys', () => {
        renderHook(() => useKeySyncReceiver('vault-one'));

        act(() =>
            useDeviceStore.setState({
                idKey: structuredClone(identity),
            })
        );

        expect(attempts).toHaveLength(1);
        expect(attempts[0].signal.aborted).toBe(false);
    });

    it('replaces the receiver connection when the actual device identity changes', () => {
        renderHook(() => useKeySyncReceiver('vault-one'));

        act(() =>
            useDeviceStore.setState({
                idKey: {
                    type: 'Ed25519',
                    public: 'new-public',
                    privateKey: { type: 'private', extractable: false, algorithm: { name: 'Ed25519' }, usages: ['sign'] },
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
            useKeySyncReceiver('vault-one')
        );

        await act(async () => {
            await vi.advanceTimersByTimeAsync(5 * 60_000);
        });

        expect(attempts[0].signal.aborted).toBe(true);
        expect(result.current.phase).toBe('error');
        expect(result.current.error).toContain('timed out');
    });

    it('keeps the new code when callbacks arrive from an abandoned attempt', async () => {
        const abandoned: ReceiverAttempt[] = [];
        vi.mocked(receiveVaultKey).mockImplementationOnce(async (options) => {
            abandoned.push(options);
            throw new Error('Connection lost');
        });
        const { result } = renderHook(() =>
            useKeySyncReceiver('vault-one')
        );
        await waitFor(() => expect(result.current.phase).toBe('error'));

        act(() => result.current.retry());
        act(() => attempts[0].onCode('XYZ789'));
        act(() => abandoned[0].onCode('ABC123'));

        expect(abandoned[0].signal.aborted).toBe(true);
        expect(result.current.code).toBe('XYZ789');
        expect(result.current.phase).toBe('waiting');
    });

    it('waits for a protection choice before saving the transferred key', async () => {
        const rawKey = new Uint8Array(32);
        const credentialId = new Uint8Array([1, 2, 3]).buffer;
        vi.mocked(receiveVaultKey).mockImplementationOnce(async (options) => {
            await options.saveKey(rawKey, credentialId);
        });
        const { result } = renderHook(() => useKeySyncReceiver('vault-one'));
        await waitFor(() => expect(result.current.phase).toBe('choosing'));
        expect(result.current.credentialId).toEqual(credentialId);
        expect(encryption.saveRawKey).not.toHaveBeenCalled();

        const protection = {
            userId: 'user-one',
            type: 'Password',
            salt: new Uint8Array(16),
            wrappingKey: {} as CryptoKey,
        } satisfies PreparedProtection;
        act(() => result.current.selectProtection(protection));
        await waitFor(() => expect(result.current.phase).toBe('success'));
        expect(encryption.saveRawKey).toHaveBeenCalledWith('vault-one', protection, rawKey);
    });
});
