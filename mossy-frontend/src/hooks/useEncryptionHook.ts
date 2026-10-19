import sodium from 'libsodium-wrappers-sumo';
import { getDeviceDatabase } from '../auth/deviceIdentity.ts';
import { KeyNotFoundException } from '../exception/KeyNotFoundException.ts';
import { useAuthStore } from '../store/authStore.ts';
import { useEncryptionStore } from '../store/encryptionStore.ts';
import { useDeviceKeys } from './useDeviceKeys.ts';
import { useVaultKey } from './useVaultKey.ts';

export class PrfNotSupportedError extends Error {
    constructor() {
        super('This passkey does not support PRF. Use a vault password instead.');
    }
}

export const VAULT_PASSWORD_MIN_LENGTH = 12;
export type VaultMethod = 'PRF' | 'Password';
export type VaultKeySetup =
    | { type: 'PRF'; createNew?: boolean }
    | { type: 'Password'; password: string };
export type VaultKeyMetadata = { type: VaultMethod };
export type PreparedProtection = {
    userId: string;
    wrappingKey: CryptoKey;
} & (
    | { type: 'PRF' }
    | { type: 'Password'; salt: Uint8Array<ArrayBuffer> }
);

type VaultKeyRecord = {
    wrappedKey: ArrayBuffer;
} & (
    | { type: 'PRF' }
    | { type: 'Password'; salt: Uint8Array<ArrayBuffer> }
);

function activeUser(): string {
    const userId = useAuthStore.getState().userDetails?.userId;
    if (!userId) throw new Error('User details not available.');
    return userId;
}

function requireUser(userId: string): void {
    if (activeUser() !== userId)
        throw new Error('Account changed. Please try again.');
}

function isVaultKeyRecord(value: object | null | undefined): value is VaultKeyRecord {
    return (
        !!value &&
        'type' in value &&
        (value.type === 'PRF' ||
            (value.type === 'Password' &&
                'salt' in value &&
                value.salt instanceof Uint8Array)) &&
        'wrappedKey' in value &&
        value.wrappedKey instanceof ArrayBuffer
    );
}

function prfBytes(results: AuthenticationExtensionsClientOutputs): Uint8Array<ArrayBuffer> {
    const first = results.prf?.results?.first;
    if (!first || first.byteLength !== 32) throw new PrfNotSupportedError();
    const bytes = new Uint8Array(32);
    if (first instanceof ArrayBuffer) bytes.set(new Uint8Array(first));
    else bytes.set(new Uint8Array(first.buffer, first.byteOffset, first.byteLength));
    return bytes;
}

async function importWrappingKey(bytes: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        'raw',
        bytes,
        { name: 'AES-KW', length: 256 },
        false,
        ['wrapKey', 'unwrapKey']
    );
}

async function passwordWrappingKey(
    password: string,
    salt: Uint8Array<ArrayBuffer>
): Promise<CryptoKey> {
    await sodium.ready;
    const bytes = sodium.crypto_pwhash(
        32,
        password,
        salt,
        sodium.crypto_pwhash_OPSLIMIT_MODERATE,
        sodium.crypto_pwhash_MEMLIMIT_MODERATE,
        sodium.crypto_pwhash_ALG_ARGON2ID13
    );
    try {
        return await importWrappingKey(new Uint8Array(bytes));
    } finally {
        sodium.memzero(bytes);
    }
}

async function readVaultKey(vaultId: string): Promise<VaultKeyRecord> {
    activeUser();
    const db = await getDeviceDatabase();
    const value = await db.get('keys', vaultId);
    if (!isVaultKeyRecord(value))
        throw new KeyNotFoundException('Vault key not found on this device.');
    return value;
}

export async function getKeyMetadata(vaultId: string): Promise<VaultKeyMetadata> {
    const record = await readVaultKey(vaultId);
    return { type: record.type };
}

async function saveWrappedKey(
    vaultId: string,
    protection: PreparedProtection,
    dataKey: CryptoKey,
    createOnly: boolean
): Promise<void> {
    requireUser(protection.userId);
    const wrappedKey = await crypto.subtle.wrapKey(
        'raw',
        dataKey,
        protection.wrappingKey,
        'AES-KW'
    );
    const record: VaultKeyRecord = protection.type === 'Password'
        ? { type: 'Password', salt: protection.salt, wrappedKey }
        : { type: 'PRF', wrappedKey };
    requireUser(protection.userId);
    const db = await getDeviceDatabase();
    if (createOnly) await db.add('keys', record, vaultId);
    else await db.put('keys', record, vaultId);
    useEncryptionStore.getState().setKey(vaultId, protection.userId, dataKey);
}

export async function registerVaultKey(
    vaultId: string,
    protection: PreparedProtection
): Promise<void> {
    const dataKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
    await saveWrappedKey(vaultId, protection, dataKey, true);
}

export async function saveRawKey(
    vaultId: string,
    protection: PreparedProtection,
    rawKey: Uint8Array<ArrayBuffer>
): Promise<void> {
    const dataKey = await crypto.subtle.importKey(
        'raw',
        rawKey,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
    await saveWrappedKey(vaultId, protection, dataKey, false);
}

export async function isVaultUnlocked(vaultId: string): Promise<boolean> {
    await readVaultKey(vaultId);
    return useEncryptionStore.getState().getKey(vaultId) !== undefined;
}

export function getUnlockedKey(vaultId: string): CryptoKey | undefined {
    return useEncryptionStore.getState().getKey(vaultId);
}

function unlockedKey(vaultId: string): CryptoKey {
    const key = getUnlockedKey(vaultId);
    if (!key) throw new Error('Unlock this vault to continue.');
    return key;
}

export async function encrypt(rawData: string, vaultId: string): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            unlockedKey(vaultId),
            new TextEncoder().encode(rawData)
        )
    );
    const blob = new Uint8Array(iv.length + ciphertext.length);
    blob.set(iv);
    blob.set(ciphertext, iv.length);
    return btoa(String.fromCharCode(...blob));
}

export async function decrypt(ciphertext: string, vaultId: string): Promise<string> {
    const blob = Uint8Array.from(atob(ciphertext), (char) => char.charCodeAt(0));
    const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: blob.slice(0, 12) },
        unlockedKey(vaultId),
        blob.slice(12)
    );
    return new TextDecoder().decode(plaintext);
}

export function useEncryptionHook() {
    useDeviceKeys();
    const { registerPasskey, getPasskey } = useVaultKey();

    const prepareProtection = async (
        setup: VaultKeySetup
    ): Promise<PreparedProtection> => {
        const userId = activeUser();
        if (setup.type === 'Password') {
            if (setup.password.length < VAULT_PASSWORD_MIN_LENGTH)
                throw new Error('Use at least 12 characters for your vault password.');
            await sodium.ready;
            const salt = crypto.getRandomValues(
                new Uint8Array(sodium.crypto_pwhash_SALTBYTES)
            );
            const wrappingKey = await passwordWrappingKey(setup.password, salt);
            return { userId, type: 'Password', salt, wrappingKey };
        }

        let results: AuthenticationExtensionsClientOutputs;
        try {
            results = setup.createNew
                ? (await registerPasskey()).results
                : await getPasskey();
        } catch (error) {
            if (error instanceof DOMException && error.name === 'NotSupportedError')
                throw new PrfNotSupportedError();
            throw error;
        }
        requireUser(userId);
        const wrappingKey = await importWrappingKey(prfBytes(results));
        return { userId, type: 'PRF', wrappingKey };
    };

    const unlockVault = async (vaultId: string, password?: string): Promise<void> => {
        const userId = activeUser();
        const record = await readVaultKey(vaultId);
        let wrappingKey: CryptoKey;
        if (record.type === 'Password') {
            if (!password) throw new Error('Enter your vault password.');
            wrappingKey = await passwordWrappingKey(password, record.salt);
        } else {
            try {
                wrappingKey = await importWrappingKey(
                    prfBytes(await getPasskey())
                );
            } catch (error) {
                if (error instanceof DOMException && error.name === 'NotSupportedError')
                    throw new PrfNotSupportedError();
                throw error;
            }
        }
        let dataKey: CryptoKey;
        try {
            dataKey = await crypto.subtle.unwrapKey(
                'raw',
                record.wrappedKey,
                wrappingKey,
                'AES-KW',
                { name: 'AES-GCM', length: 256 },
                true,
                ['encrypt', 'decrypt']
            );
        } catch {
            throw new Error('Could not unlock the vault. Check your password or passkey.');
        }
        requireUser(userId);
        useEncryptionStore.getState().setKey(vaultId, userId, dataKey);
    };

    return {
        prepareProtection,
        unlockVault,
        registerVaultKey,
        saveRawKey,
        getKeyMetadata,
        isVaultUnlocked,
        getUnlockedKey,
        encrypt,
        decrypt,
    };
}
