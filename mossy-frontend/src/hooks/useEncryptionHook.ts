import { useCallback } from 'react';
import sodium from 'libsodium-wrappers-sumo';
import { useKeyStorage } from './useKeyStorage.ts';
import { useEncryptionStore } from '../store/encryptionStore.ts';

export type UseEncryptionResult = {
    encrypt: (password: string, vaultId: string) => Promise<string>;
    decrypt: (ciphertext: string, vaultId: string) => Promise<string>;
    isVaultUnlocked: (id: string) => Promise<boolean>;
};

export function useEncryptionHook(): UseEncryptionResult {
    const { loadKey, getKeyMetadata } = useKeyStorage();

    const encrypt = useCallback(
        async (rawPassword: string, vaultId: string) => {
            const passkey = useEncryptionStore.getState().getPasskey(vaultId);

            if (!passkey) {
                throw new Error('Passkey not found');
            }

            const loadedKey = await loadKey(vaultId, passkey);
            await sodium.ready;

            const iv = new Uint8Array(sodium.randombytes_buf(12));
            const encoder = new TextEncoder();
            const plaintext = encoder.encode(rawPassword);

            const ciphertext = new Uint8Array(
                await crypto.subtle.encrypt(
                    { name: 'AES-GCM', iv },
                    loadedKey,
                    plaintext
                )
            );

            const blob = new Uint8Array(iv.length + ciphertext.length);
            blob.set(iv, 0);
            blob.set(ciphertext, 12);

            return btoa(String.fromCharCode(...blob));
        },
        [loadKey]
    );

    const decrypt = useCallback(
        async (ciphertext: string, vaultId: string) => {
            const passkey = useEncryptionStore.getState().getPasskey(vaultId);

            if (!passkey) {
                throw new Error('Passkey not found');
            }

            const loadedKey = await loadKey(vaultId, passkey);
            const blob = new Uint8Array(
                atob(ciphertext)
                    .split('')
                    .map((c) => c.charCodeAt(0))
            );

            const iv = blob.slice(0, 12);
            const ciphertextBytes = blob.slice(12);

            const decryptedBytes = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: new Uint8Array(iv) },
                loadedKey,
                ciphertextBytes
            );

            return new TextDecoder().decode(decryptedBytes);
        },
        [loadKey]
    );

    const isVaultUnlocked = useCallback(
        async (id: string) => {
            await getKeyMetadata(id);

            return useEncryptionStore.getState().getPasskey(id) !== undefined;
        },
        [getKeyMetadata]
    );

    return { encrypt, decrypt, isVaultUnlocked };
}
