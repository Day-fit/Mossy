import { useCallback, useEffect, useRef, useState } from 'react';
import { useDeviceStore } from '../store/deviceStore.ts';
import { receiveVaultKey } from '../key-sync/receiveVaultKey.ts';
import {
    useEncryptionHook,
    type PreparedProtection,
} from './useEncryptionHook.ts';

type ReceiverState = {
    phase:
        | 'preparing'
        | 'waiting'
        | 'receiving'
        | 'choosing'
        | 'saving'
        | 'success'
        | 'error';
    code?: string;
    error?: string;
    credentialId?: ArrayBuffer;
};

export function useKeySyncReceiver(vaultId: string) {
    const receiverId = useDeviceStore((state) => state.deviceId);
    const identityPublicKey = useDeviceStore((state) => state.idKey?.public);
    const { saveRawKey } = useEncryptionHook();
    const [state, setState] = useState<ReceiverState>({ phase: 'preparing' });
    const [attempt, setAttempt] = useState(0);
    const pendingSelection = useRef<{
        controller: AbortController;
        select: (protection: PreparedProtection) => void;
    } | null>(null);
    const selectProtection = useCallback((protection: PreparedProtection) => {
        pendingSelection.current?.select(protection);
    }, []);

    useEffect(() => {
        const identity = useDeviceStore.getState().idKey;
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

        function chooseProtection(credentialId?: ArrayBuffer) {
            controller.signal.throwIfAborted();
            return new Promise<PreparedProtection>((resolve, reject) => {
                const onAbort = () => reject(controller.signal.reason);
                controller.signal.addEventListener('abort', onAbort, {
                    once: true,
                });
                pendingSelection.current = {
                    controller,
                    select: (protection) => {
                        controller.signal.removeEventListener('abort', onAbort);
                        if (pendingSelection.current?.controller === controller)
                            pendingSelection.current = null;
                        resolve(protection);
                    },
                };
                if (!disposed) setState({ phase: 'choosing', credentialId });
            });
        }

        async function receive() {
            if (!receiverId || !identity) return;
            try {
                await receiveVaultKey({
                    vaultId,
                    receiverId,
                    identity,
                    signal: controller.signal,
                    onCode: (code) => {
                        if (!disposed) setState({ phase: 'waiting', code });
                    },
                    onReceiving: () => {
                        if (!disposed)
                            setState((current) => ({
                                ...current,
                                phase: 'receiving',
                            }));
                    },
                    saveKey: async (rawKey, credentialId) => {
                        const protection = await chooseProtection(credentialId);
                        controller.signal.throwIfAborted();
                        if (!disposed) setState({ phase: 'saving' });
                        await saveRawKey(vaultId, protection, rawKey);
                    },
                });
                if (!disposed) setState({ phase: 'success' });
            } catch (error) {
                if (disposed) return;
                const reason =
                    controller.signal.aborted &&
                    controller.signal.reason instanceof Error
                        ? controller.signal.reason
                        : error;
                setState({
                    phase: 'error',
                    error:
                        reason instanceof Error
                            ? reason.message
                            : 'Key synchronization failed.',
                });
            } finally {
                if (pendingSelection.current?.controller === controller)
                    pendingSelection.current = null;
                clearTimeout(timer);
            }
        }
        void receive();
        return () => {
            disposed = true;
            if (pendingSelection.current?.controller === controller)
                pendingSelection.current = null;
            clearTimeout(timer);
            controller.abort();
        };
    }, [attempt, identityPublicKey, receiverId, saveRawKey, vaultId]);

    return {
        ...state,
        selectProtection,
        retry: () => {
            setState({ phase: 'preparing' });
            setAttempt((current) => current + 1);
        },
    };
}
