import sodium from 'libsodium-wrappers-sumo';
import { getDeviceDatabase } from '../auth/deviceIdentity.ts';
import { requireActiveUser } from '../auth/activeUser.ts';
import { KeyNotFoundException } from '../exception/KeyNotFoundException.ts';
import { useEncryptionStore } from '../store/encryptionStore.ts';
import { useAuthStore } from '../store/authStore.ts';
import { vaultKeyId } from './keyIds.ts';
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

async function deriveWrappingKey(
    passkey: Uint8Array,
    salt: Uint8Array<ArrayBuffer>,
    type: VaultKeyMetadata['type']
) {
    if (type === 'Text') {
        await sodium.ready;
        const passwordSalt = salt.subarray(0, sodium.crypto_pwhash_SALTBYTES);
        const bytes = sodium.crypto_pwhash(
            32,
            new TextDecoder().decode(passkey),
            passwordSalt,
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
    const material = await crypto.subtle.importKey(
        'raw',
        new Uint8Array(passkey),
        'HKDF',
        false,
        ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        {
            name: 'HKDF',
            hash: 'SHA-256',
            salt,
            info: new TextEncoder().encode('Mossy vault wrapping key v1'),
        },
        material,
        { name: 'AES-KW', length: 256 },
        false,
        ['wrapKey', 'unwrapKey']
    );
}

function metadataFrom(record: VaultKeyMetadata): VaultKeyMetadata {
    return record.type === 'Text'
        ? { type: 'Text' }
        : {
              type: 'PRF',
              credentialId: record.credentialId,
              prfSalt: new Uint8Array(record.prfSalt),
          };
}

const activeOwner = () =>
    requireActiveUser(useAuthStore.getState().userDetails?.userId);

const getKeyMetadata = async (vaultId: string) => {
    const owner = activeOwner();
    return metadataFrom(await getKeyRecord(owner, vaultId));
};

const loadKey = async (vaultId: string, passkey: Uint8Array) => {
    const owner = activeOwner();
    const session = useEncryptionStore.getState();
    const cached = session.getKey(vaultId);
    if (cached && session.getPasskey(vaultId) === passkey) return cached;
    const record = await getKeyRecord(owner, vaultId);
    const { wrappedKey, salt } = record;
    const wrappingKey = await deriveWrappingKey(passkey, salt, record.type);

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
        throw new Error(
            record.type === 'Text'
                ? 'Invalid vault password'
                : 'Invalid passkey'
        );
    }

    requireActiveUser(owner);
    return key;
};

const wrapAndStore = async (
    vaultId: string,
    passkey: Uint8Array,
    dataKey: CryptoKey,
    metadata: VaultKeyMetadata,
    owner: string,
    createOnly = false
) => {
    requireActiveUser(owner);
    const db = await getDeviceDatabase();

    const salt = crypto.getRandomValues(new Uint8Array(32));
    const wrappingKey = await deriveWrappingKey(passkey, salt, metadata.type);

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
};

const saveKey = async (
    vaultId: string,
    passkey: Uint8Array,
    metadata: VaultKeyMetadata
) => {
    const owner = activeOwner();
    const dataKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );

    await wrapAndStore(vaultId, passkey, dataKey, metadata, owner, true);
    return dataKey;
};

const saveRawKey = async (
    vaultId: string,
    passkey: Uint8Array,
    rawKey: Uint8Array<ArrayBuffer>,
    metadata: VaultKeyMetadata
) => {
    const owner = activeOwner();
    const dataKey = await crypto.subtle.importKey(
        'raw',
        rawKey,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );

    await wrapAndStore(vaultId, passkey, dataKey, metadata, owner);
    return dataKey;
};

export const keyStorage = { saveKey, saveRawKey, loadKey, getKeyMetadata };
