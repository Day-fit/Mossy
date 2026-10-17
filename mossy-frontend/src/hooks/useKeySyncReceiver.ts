import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDeviceStore } from '../store/deviceStore.ts';
import { useEncryptionHook } from './useEncryptionHook.ts';
import { receiveVaultKey } from '../key-sync/receiveVaultKey.ts';

type ReceiverState = {
    phase: 'preparing' | 'waiting' | 'saving' | 'success' | 'error';
    code?: string;
    error?: string;
};

export function useKeySyncReceiver(vaultId: string, pin: string) {
    const receiverId = useDeviceStore((state) => state.deviceId);
    const identity = useDeviceStore(useShallow((state) => state.idKey));
    const { saveRawKey, setPin } = useEncryptionHook();
    const [state, setState] = useState<ReceiverState>({ phase: 'preparing' });
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        if (!receiverId || !identity) return;
        const controller = new AbortController();
        let disposed = false;
        const timer = setTimeout(
            () =>
                controller.abort(
                    new Error(
                        'Key synchronization timed out. Please generate a new code.'
                    )
                ),
            5 * 60_000
        );

        void receiveVaultKey({
            vaultId,
            receiverId,
            identity,
            signal: controller.signal,
            onCode: (code) => {
                if (!disposed) setState({ phase: 'waiting', code });
            },
            onReceiving: () => {
                if (!disposed)
                    setState((current) => ({ ...current, phase: 'saving' }));
            },
            saveKey: async (key) => {
                await saveRawKey(vaultId, pin, key);
                if (!controller.signal.aborted) setPin(vaultId, pin);
            },
        })
            .then(() => {
                if (!disposed) setState({ phase: 'success' });
            })
            .catch((error: unknown) => {
                if (disposed) return;
                const reason: unknown = controller.signal.aborted
                    ? controller.signal.reason
                    : error;
                setState({
                    phase: 'error',
                    error:
                        reason instanceof Error
                            ? reason.message
                            : 'Key synchronization failed.',
                });
            })
            .finally(() => clearTimeout(timer));

        return () => {
            disposed = true;
            clearTimeout(timer);
            controller.abort();
        };
    }, [attempt, identity, pin, receiverId, saveRawKey, setPin, vaultId]);

    return {
        ...state,
        retry: () => {
            setState({ phase: 'preparing' });
            setAttempt((current) => current + 1);
        },
    };
}
