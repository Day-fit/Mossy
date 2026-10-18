import { useCallback } from 'react';
import sodium from 'libsodium-wrappers-sumo';
import { getDeviceDatabase } from '../auth/deviceIdentity.ts';
import { requireActiveUser } from '../auth/activeUser.ts';
import { KeyNotFoundException } from '../exception/KeyNotFoundException.ts';
import { useEncryptionStore } from '../store/encryptionStore.ts';
import { useAuthStore } from '../store/authStore.ts';
import { userPasskeyId, vaultKeyId } from '../storage/keyIds.ts';
import type { StoredVaultKey, VaultKeyMetadata } from '../types/vaultKey.ts';

async function getKeyRecord(
    userId: string,
    vaultId: string
): Promise<StoredVaultKey> {
    requireActiveUser(userId);
    const db = await getDeviceDatabase();
    const record = await db.get('keys', vaultKeyId(userId, vaultId));
    requireActiveUser(userId);

    if (!record || (record.type !== 'PRF' && record.type !== 'Text')) {
        throw new KeyNotFoundException('Key not found');
    }

    return record;
}

async function deriveWrappingKey(passkey: Uint8Array, salt: Uint8Array) {
    await sodium.ready;

    const bytes = sodium.crypto_pwhash(
        32,
        passkey,
        salt,
        sodium.crypto_pwhash_OPSLIMIT_MODERATE,
        sodium.crypto_pwhash_MEMLIMIT_MODERATE,
        sodium.crypto_pwhash_ALG_ARGON2ID13
    );

    try {
        return await crypto.subtle.importKey(
            'raw',
            new Uint8Array(bytes),
            { name: 'AES-KW', length: 256 },
            false,
            ['wrapKey', 'unwrapKey']
        );
    } finally {
        sodium.memzero(bytes);
    }
}

function metadataFrom(record: VaultKeyMetadata): VaultKeyMetadata {
    return record.type === 'PRF'
        ? {
              type: 'PRF',
              credentialId: record.credentialId,
              prfSalt: new Uint8Array(record.prfSalt),
          }
        : { type: 'Text' };
}

export function useKeyStorage() {
    const userId = useAuthStore((state) => state.userDetails?.userId);

    const getKeyMetadata = useCallback(
        async (vaultId: string) => {
            const owner = requireActiveUser(userId);
            return metadataFrom(await getKeyRecord(owner, vaultId));
        },
        [userId]
    );

    const getUserPasskey = useCallback(async () => {
        const owner = requireActiveUser(userId);
        const db = await getDeviceDatabase();
        const record = await db.get('keys', userPasskeyId(owner));
        requireActiveUser(owner);

        if (record && record.type !== 'UserPRF') {
            throw new Error('Invalid user passkey record.');
        }

        return record;
    }, [userId]);

    const saveUserPasskey = useCallback(
        async (credentialId: string) => {
            const owner = requireActiveUser(userId);
            const db = await getDeviceDatabase();
            requireActiveUser(owner);

            await db.add(
                'keys',
                { type: 'UserPRF', credentialId },
                userPasskeyId(owner)
            );
            requireActiveUser(owner);
        },
        [userId]
    );

    const loadKey = useCallback(
        async (vaultId: string, passkey: Uint8Array) => {
            const owner = requireActiveUser(userId);
            const { wrappedKey, salt } = await getKeyRecord(owner, vaultId);
            const wrappingKey = await deriveWrappingKey(passkey, salt);

            let key: CryptoKey;
            try {
                key = await crypto.subtle.unwrapKey(
                    'raw',
                    wrappedKey,
                    wrappingKey,
                    'AES-KW',
                    { name: 'AES-GCM', length: 256 },
                    true,
                    ['encrypt', 'decrypt']
                );
            } catch {
                useEncryptionStore.getState().clearPasskey(vaultId, owner);
                throw new Error('Invalid passkey');
            }

            requireActiveUser(owner);
            return key;
        },
        [userId]
    );

    const wrapAndStore = useCallback(
        async (
            vaultId: string,
            passkey: Uint8Array,
            dataKey: CryptoKey,
            metadata: VaultKeyMetadata,
            createOnly = false
        ) => {
            const owner = requireActiveUser(userId);
            const db = await getDeviceDatabase();
            await sodium.ready;

            const salt = new Uint8Array(
                sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES)
            );
            const wrappingKey = await deriveWrappingKey(passkey, salt);

            const wrappedKey = await crypto.subtle.wrapKey(
                'raw',
                dataKey,
                wrappingKey,
                'AES-KW'
            );

            const record = { ...metadataFrom(metadata), wrappedKey, salt };

            requireActiveUser(owner);
            const id = vaultKeyId(owner, vaultId);

            if (createOnly) await db.add('keys', record, id);
            else await db.put('keys', record, id);

            requireActiveUser(owner);
        },
        [userId]
    );

    const saveKey = useCallback(
        async (
            vaultId: string,
            passkey: Uint8Array,
            metadata: VaultKeyMetadata
        ) => {
            const dataKey = await crypto.subtle.generateKey(
                { name: 'AES-GCM', length: 256 },
                true,
                ['encrypt', 'decrypt']
            );

            await wrapAndStore(vaultId, passkey, dataKey, metadata, true);
        },
        [wrapAndStore]
    );

    const saveRawKey = useCallback(
        async (
            vaultId: string,
            passkey: Uint8Array,
            rawKey: Uint8Array<ArrayBuffer>,
            metadata: VaultKeyMetadata
        ) => {
            const dataKey = await crypto.subtle.importKey(
                'raw',
                rawKey,
                { name: 'AES-GCM', length: 256 },
                true,
                ['encrypt', 'decrypt']
            );

            await wrapAndStore(vaultId, passkey, dataKey, metadata);
        },
        [wrapAndStore]
    );

    return {
        saveKey,
        saveRawKey,
        loadKey,
        getKeyMetadata,
        getUserPasskey,
        saveUserPasskey,
    };
}
