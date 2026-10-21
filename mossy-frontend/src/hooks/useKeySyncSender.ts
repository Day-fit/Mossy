import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from 'mossy-api-client/client';
import { KeyNotFoundException } from '../exception/KeyNotFoundException.ts';
import { getVerifiedReceiver, sendVaultKey } from '../key-sync/sendVaultKey.ts';
import { useDeviceStore } from '../store/deviceStore.ts';
import { getVaultCredentialId, useEncryptionHook } from './useEncryptionHook.ts';

type SenderState = {
    phase: 'idle' | 'syncing' | 'needs-unlock' | 'success' | 'error';
    code: string;
    vaultId?: string;
    error?: string;
};

const idle: SenderState = { phase: 'idle', code: '' };

export function useKeySyncSender() {
    const { isVaultUnlocked, getUnlockedKey } = useEncryptionHook();
    const [state, setState] = useState<SenderState>(idle);
    const activeRequest = useRef<AbortController | null>(null);

    const send = useCallback(async (code: string): Promise<boolean> => {
        if (activeRequest.current) return false;
        const controller = new AbortController();
        activeRequest.current = controller;
        setState({ phase: 'syncing', code });
        let vaultId: string | undefined;
        try {
            const { deviceId, idKey } = useDeviceStore.getState();
            if (!deviceId || !idKey)
                throw new Error('This device is not ready. Please sign in again.');
            const receiver = await getVerifiedReceiver(
                code,
                deviceId,
                controller.signal
            );
            controller.signal.throwIfAborted();
            vaultId = receiver.vaultId;
            if (!(await isVaultUnlocked(vaultId))) {
                setState({ phase: 'needs-unlock', code, vaultId });
                return false;
            }
            const key = getUnlockedKey(vaultId);
            if (!key) throw new Error('Unlock this vault to continue.');
            const credentialId = await getVaultCredentialId(vaultId);
            await sendVaultKey(
                code,
                receiver,
                deviceId,
                idKey,
                key,
                credentialId,
                controller.signal
            );
            if (controller.signal.aborted) return false;
            setState({ phase: 'success', code, vaultId });
            return true;
        } catch (error) {
            if (controller.signal.aborted) return false;
            let message = error instanceof Error
                ? error.message
                : 'Key synchronization failed.';
            if (error instanceof ApiError && error.status === 404)
                message = 'This sync code is no longer available. Generate a new code on the receiving device.';
            else if (error instanceof KeyNotFoundException)
                message = 'This device does not have the vault key. Use a device that can already unlock the vault.';
            setState({ phase: 'error', code, vaultId, error: message });
            return false;
        } finally {
            if (activeRequest.current === controller) activeRequest.current = null;
        }
    }, [getUnlockedKey, isVaultUnlocked]);

    useEffect(() => () => {
        activeRequest.current?.abort();
        activeRequest.current = null;
    }, []);

    const reset = useCallback(() => {
        activeRequest.current?.abort();
        activeRequest.current = null;
        setState(idle);
    }, []);

    const cancelUnlock = useCallback(() => {
        setState((current) =>
            current.phase === 'needs-unlock' ? idle : current
        );
    }, []);

    return { ...state, send, reset, cancelUnlock };
}
