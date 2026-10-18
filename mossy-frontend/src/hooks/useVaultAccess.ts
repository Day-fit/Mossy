import { useCallback } from 'react';
import type { VaultKeyMetadata } from '../types/vaultKey.ts';
import { requireActiveUser } from '../auth/activeUser.ts';
import { getPasskey, preparePasskey } from '../auth/passkeys.ts';
import { useAuthStore } from '../store/authStore.ts';
import { KeyNotFoundException } from '../exception/KeyNotFoundException.ts';
import { useEncryptionStore } from '../store/encryptionStore.ts';
import { keyStorage } from '../storage/vaultKeys.ts';

export const VAULT_PASSWORD_MIN_LENGTH = 12;
export type VaultKeySetup =
    | { type: 'PRF' }
    | { type: 'Text'; password: string };

export class PrfNotSupportedError extends Error {
    constructor() {
        super(
            'Passkeys are unavailable on this device. Create a vault password instead.'
        );
    }
}

export function useVaultAccess() {
    const userId = useAuthStore((state) => state.userDetails?.userId);
    const prepareProtection = useCallback(
        async (vaultId: string, setup: VaultKeySetup, signal?: AbortSignal) => {
            if (!vaultId) throw new Error('Vault ID not available.');
            signal?.throwIfAborted();
            const owner = requireActiveUser(userId);
            if (setup.type === 'Text') {
                if (setup.password.length < VAULT_PASSWORD_MIN_LENGTH)
                    throw new Error(
                        `Use at least ${VAULT_PASSWORD_MIN_LENGTH} characters for your vault password.`
                    );
                signal?.throwIfAborted();
                return {
                    userId: owner,
                    passkey: new TextEncoder().encode(setup.password),
                    metadata: { type: 'Text' } satisfies VaultKeyMetadata,
                };
            }
            try {
                return await preparePasskey(owner, signal);
            } catch (error) {
                if (
                    error instanceof Error &&
                    (error.message.startsWith('PRF is not supported') ||
                        error.message ===
                            'Passkeys are unavailable on this device.' ||
                        error.name === 'NotSupportedError')
                ) {
                    throw new PrfNotSupportedError();
                }
                throw error;
            }
        },
        [userId]
    );

    const registerVaultKey = useCallback(
        async (vaultId: string, setup: VaultKeySetup, signal?: AbortSignal) => {
            const owner = requireActiveUser(userId);
            signal?.throwIfAborted();
            const existing = await keyStorage
                .getKeyMetadata(vaultId)
                .catch((error) => {
                    if (error instanceof KeyNotFoundException) return null;
                    throw error;
                });
            requireActiveUser(owner);
            if (existing)
                throw new Error(
                    'This vault already has a key on this device. Unlock it instead.'
                );
            const protection = await prepareProtection(vaultId, setup, signal);
            requireActiveUser(owner);
            signal?.throwIfAborted();
            const key = await keyStorage.saveKey(
                vaultId,
                protection.passkey,
                protection.metadata
            );
            requireActiveUser(owner);
            signal?.throwIfAborted();
            useEncryptionStore
                .getState()
                .setUnlocked(vaultId, protection.passkey, key, owner);
        },
        [userId, prepareProtection]
    );

    const unlockVault = useCallback(
        async (vaultId: string, password?: string, signal?: AbortSignal) => {
            const owner = requireActiveUser(userId);
            signal?.throwIfAborted();
            const metadata = await keyStorage.getKeyMetadata(vaultId);
            requireActiveUser(owner);
            signal?.throwIfAborted();
            let passkey: Uint8Array<ArrayBuffer>;
            if (metadata.type === 'PRF') {
                passkey = await getPasskey(
                    metadata.credentialId,
                    metadata.prfSalt,
                    signal
                );
            } else {
                if (!password) throw new Error('Enter your vault password.');
                passkey = new TextEncoder().encode(password);
            }
            requireActiveUser(owner);
            signal?.throwIfAborted();
            const key = await keyStorage.loadKey(vaultId, passkey);
            requireActiveUser(owner);
            signal?.throwIfAborted();
            useEncryptionStore
                .getState()
                .setUnlocked(vaultId, passkey, key, owner);
        },
        [userId]
    );

    const getKeyMetadata = useCallback(
        (vaultId: string) => keyStorage.getKeyMetadata(vaultId),
        []
    );

    return { registerVaultKey, unlockVault, prepareProtection, getKeyMetadata };
}
