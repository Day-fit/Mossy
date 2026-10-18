import { useEffect, useState } from 'react';
import { requireActiveUser } from '../auth/activeUser.ts';
import { useAuthStore } from '../store/authStore.ts';
import { useShallow } from 'zustand/react/shallow';
import { useDeviceStore } from '../store/deviceStore.ts';
import { keyStorage } from '../storage/vaultKeys.ts';
import { useEncryptionStore } from '../store/encryptionStore.ts';
import { receiveVaultKey } from '../key-sync/receiveVaultKey.ts';
import type { VaultKeyProtection } from '../types/vaultKey.ts';

type ReceiverState = {
    phase: 'preparing' | 'waiting' | 'saving' | 'success' | 'error';
    code?: string;
    error?: string;
};

export function useKeySyncReceiver(
    vaultId: string,
    protection: VaultKeyProtection
) {
    const { passkey, metadata, userId: owner } = protection;
    const userId = useAuthStore((state) => state.userDetails?.userId);

    const receiverId = useDeviceStore((state) => state.deviceId);
    const identity = useDeviceStore(useShallow((state) => state.idKey));
    const { saveRawKey } = keyStorage;
    const setUnlocked = useEncryptionStore((state) => state.setUnlocked);

    const [state, setState] = useState<ReceiverState>({ phase: 'preparing' });
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        if (!receiverId || !identity || owner !== userId) return;

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
                controller.signal.throwIfAborted();
                requireActiveUser(owner);
                const dataKey = await saveRawKey(
                    vaultId,
                    passkey,
                    key,
                    metadata
                );

                if (!controller.signal.aborted)
                    setUnlocked(vaultId, passkey, dataKey, owner);
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
    }, [
        attempt,
        owner,
        userId,
        identity,
        metadata,
        passkey,
        receiverId,
        saveRawKey,
        setUnlocked,
        vaultId,
    ]);

    return {
        ...state,
        retry: () => {
            setState({ phase: 'preparing' });
            setAttempt((current) => current + 1);
        },
    };
}
