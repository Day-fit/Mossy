import { useCallback } from 'react';
import { requireActiveUser } from '../auth/activeUser.ts';
import { withUserPasskeyLock } from '../auth/userPasskeyLock.ts';
import { useAuthStore } from '../store/authStore.ts';
import { KeyNotFoundException } from '../exception/KeyNotFoundException.ts';
import { useEncryptionStore } from '../store/encryptionStore.ts';
import type { VaultKeyProtection } from '../types/vaultKey.ts';
import { useKeyStorage } from './useKeyStorage.ts';
import { useVaultKey } from './useVaultKey.ts';

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

export function supportsPasskeys() {
    return (
        typeof PublicKeyCredential !== 'undefined' &&
        typeof navigator.credentials?.create === 'function' &&
        typeof navigator.credentials?.get === 'function'
    );
}

function copyBytes(value: BufferSource): Uint8Array<ArrayBuffer> {
    return ArrayBuffer.isView(value)
        ? new Uint8Array(
              new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
          )
        : new Uint8Array(value.slice(0));
}

export function useVaultAccess() {
    const userId = useAuthStore((state) => state.userDetails?.userId);
    const { registerPasskey, getPasskey } = useVaultKey();
    const {
        saveKey,
        loadKey,
        getKeyMetadata,
        getUserPasskey,
        saveUserPasskey,
    } = useKeyStorage();

    const prepareProtection = useCallback(
        async (
            vaultId: string,
            setup: VaultKeySetup,
            signal?: AbortSignal
        ): Promise<VaultKeyProtection> => {
            const owner = requireActiveUser(userId);
            signal?.throwIfAborted();
            if (!vaultId) throw new Error('Vault ID not available.');

            if (setup.type === 'Text') {
                if (setup.password.length < VAULT_PASSWORD_MIN_LENGTH) {
                    throw new Error(
                        `Use at least ${VAULT_PASSWORD_MIN_LENGTH} characters for your vault password.`
                    );
                }

                return {
                    userId: owner,
                    passkey: new TextEncoder().encode(setup.password),
                    metadata: { type: 'Text' },
                };
            }

            if (!supportsPasskeys()) throw new PrfNotSupportedError();

            try {
                return await withUserPasskeyLock(
                    owner,
                    async () => {
                        requireActiveUser(owner);
                        const existing = await getUserPasskey();
                        requireActiveUser(owner);
                        signal?.throwIfAborted();

                        if (existing) {
                            const salt = crypto.getRandomValues(
                                new Uint8Array(32)
                            );
                            const result = await getPasskey(
                                existing.credentialId,
                                salt
                            );
                            requireActiveUser(owner);
                            signal?.throwIfAborted();

                            if (!result.prf?.results?.first)
                                throw new PrfNotSupportedError();

                            return {
                                userId: owner,
                                passkey: copyBytes(result.prf.results.first),
                                metadata: {
                                    type: 'PRF',
                                    credentialId: existing.credentialId,
                                    prfSalt: salt,
                                },
                            };
                        }

                        const { credential, salt, metadata } =
                            await registerPasskey();
                        requireActiveUser(owner);

                        const first =
                            credential.getClientExtensionResults().prf?.results
                                ?.first ??
                            (await getPasskey(credential.id, salt)).prf?.results
                                ?.first;
                        requireActiveUser(owner);
                        if (!first) throw new PrfNotSupportedError();

                        // Keep the credential even if vault setup is canceled or saving its key fails.
                        await saveUserPasskey(credential.id);
                        signal?.throwIfAborted();

                        return {
                            userId: owner,
                            passkey: copyBytes(first),
                            metadata,
                        };
                    },
                    signal
                );
            } catch (error) {
                if (
                    error instanceof Error &&
                    (error.message === 'PRF is not supported' ||
                        error.name === 'NotSupportedError')
                ) {
                    throw new PrfNotSupportedError();
                }

                throw error;
            }
        },
        [userId, getPasskey, registerPasskey, getUserPasskey, saveUserPasskey]
    );

    const registerVaultKey = useCallback(
        async (vaultId: string, setup: VaultKeySetup, signal?: AbortSignal) => {
            signal?.throwIfAborted();

            const existing = await getKeyMetadata(vaultId).catch(
                (error: unknown) => {
                    if (error instanceof KeyNotFoundException) return null;
                    throw error;
                }
            );

            if (existing) {
                throw new Error(
                    'This vault already has a key on this device. Unlock it instead.'
                );
            }

            const protection = await prepareProtection(vaultId, setup, signal);
            signal?.throwIfAborted();

            requireActiveUser(protection.userId);
            await saveKey(vaultId, protection.passkey, protection.metadata);
            signal?.throwIfAborted();

            useEncryptionStore
                .getState()
                .setPasskey(vaultId, protection.passkey, protection.userId);
        },
        [getKeyMetadata, prepareProtection, saveKey]
    );

    const unlockVault = useCallback(
        async (vaultId: string, password?: string, signal?: AbortSignal) => {
            const owner = requireActiveUser(userId);
            signal?.throwIfAborted();

            const metadata = await getKeyMetadata(vaultId);
            requireActiveUser(owner);
            signal?.throwIfAborted();

            let passkey: Uint8Array<ArrayBuffer>;

            if (metadata.type === 'PRF') {
                if (!supportsPasskeys()) {
                    throw new Error(
                        'Unlock this vault on a device that supports passkeys, or sync its key from another device.'
                    );
                }

                const result = await getPasskey(
                    metadata.credentialId,
                    metadata.prfSalt
                );

                if (!result.prf?.results?.first)
                    throw new Error('The passkey did not return a vault key.');

                passkey = copyBytes(result.prf.results.first);
            } else {
                if (!password) throw new Error('Enter your vault password.');
                passkey = new TextEncoder().encode(password);
            }

            signal?.throwIfAborted();
            await loadKey(vaultId, passkey);
            signal?.throwIfAborted();

            useEncryptionStore.getState().setPasskey(vaultId, passkey, owner);
        },
        [userId, getKeyMetadata, getPasskey, loadKey]
    );

    return { registerVaultKey, unlockVault, prepareProtection, getKeyMetadata };
}
