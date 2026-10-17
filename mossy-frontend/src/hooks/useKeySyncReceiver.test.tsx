import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { receiveVaultKey } from '../key-sync/receiveVaultKey.ts';
import { useDeviceStore } from '../store/deviceStore.ts';
import { useKeySyncReceiver } from './useKeySyncReceiver.ts';

const encryption = vi.hoisted(() => ({ saveRawKey: vi.fn(), setPin: vi.fn() }));
vi.mock('./useEncryptionHook.ts', () => ({
    useEncryptionHook: () => encryption,
}));
vi.mock('../key-sync/receiveVaultKey.ts', () => ({ receiveVaultKey: vi.fn() }));

describe('receiver lifecycle', () => {
    const attempts: Parameters<typeof receiveVaultKey>[0][] = [];
    beforeEach(() => {
        vi.resetAllMocks();
        attempts.length = 0;
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
            useKeySyncReceiver('vault-one', '1234')
        );
        expect(attempts).toHaveLength(1);

        unmount();

        expect(attempts[0].signal.aborted).toBe(true);
    });

    it('keeps the receiver connection open when device identity is reloaded with the same keys', () => {
        renderHook(() => useKeySyncReceiver('vault-one', '1234'));

        act(() =>
            useDeviceStore.setState({
                idKey: { ...useDeviceStore.getState().idKey! },
            })
        );

        expect(attempts).toHaveLength(1);
        expect(attempts[0].signal.aborted).toBe(false);
    });

    it('replaces the receiver connection when the actual device identity changes', () => {
        renderHook(() => useKeySyncReceiver('vault-one', '1234'));

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
            useKeySyncReceiver('vault-one', '1234')
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
            useKeySyncReceiver('vault-one', '1234')
        );
        await waitFor(() => expect(result.current.phase).toBe('error'));

        act(() => result.current.retry());
        act(() => attempts[0].onCode('XYZ789'));
        act(() => oldOptions.onCode('ABC123'));

        expect(oldOptions.signal.aborted).toBe(true);
        expect(result.current.code).toBe('XYZ789');
        expect(result.current.phase).toBe('waiting');
    });
});
