import sodium from 'libsodium-wrappers-sumo';
import type { Scope, WrappedKeyRecord } from '../types/vault';

export const VAULT_PASSWORD_MIN_LENGTH = 12;

export const prfInput = (vaultId: string) =>
    new TextEncoder().encode(`mossy:encryption:v1:vault:${vaultId}`);

export class PrfNotSupportedError extends Error {
    constructor() {
        super(
            'This passkey does not support PRF. Use a vault password instead.'
        );
    }
}

export function prfBytes(
    results: AuthenticationExtensionsClientOutputs
): Uint8Array<ArrayBuffer> {
    const first = results.prf?.results?.first;

    const isInvalidPrfOutput = !first || first.byteLength !== 32;
    if (isInvalidPrfOutput) {
        throw new PrfNotSupportedError();
    }

    const bytes = new Uint8Array(32);

    if (first instanceof ArrayBuffer) {
        bytes.set(new Uint8Array(first));
    } else {
        bytes.set(
            new Uint8Array(first.buffer, first.byteOffset, first.byteLength)
        );
    }

    return bytes;
}

export function importWrappingKey(
    bytes: Uint8Array<ArrayBuffer>
): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        'raw',
        bytes,
        { name: 'AES-KW', length: 256 },
        false,
        ['wrapKey', 'unwrapKey']
    );
}

export async function passwordWrappingKey(
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
    const material = new Uint8Array(bytes);

    try {
        return await importWrappingKey(material);
    } finally {
        material.fill(0);
        sodium.memzero(bytes);
    }
}

export function unwrapVaultKey(
    record: WrappedKeyRecord,
    wrappingKey: CryptoKey,
    extractable = false
): Promise<CryptoKey> {
    return crypto.subtle.unwrapKey(
        'raw',
        record.wrappedKey,
        wrappingKey,
        'AES-KW',
        { name: 'AES-GCM', length: 256 },
        extractable,
        ['encrypt', 'decrypt']
    );
}

export async function encryptWithKey(
    rawData: string,
    key: CryptoKey
): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            new TextEncoder().encode(rawData)
        )
    );
    const blob = new Uint8Array(iv.length + ciphertext.length);
    blob.set(iv);
    blob.set(ciphertext, iv.length);

    return btoa(Array.from(blob, (byte) => String.fromCharCode(byte)).join(''));
}

export async function decryptWithKey(
    ciphertext: string,
    key: CryptoKey
): Promise<string> {
    const blob = Uint8Array.from(atob(ciphertext), (char) =>
        char.charCodeAt(0)
    );

    if (blob.length < 28) {
        throw new Error('Invalid encrypted secret.');
    }

    const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: blob.slice(0, 12) },
        key,
        blob.slice(12)
    );

    return new TextDecoder().decode(plaintext);
}

export const scopeKey = (scope: Scope) =>
    JSON.stringify([scope.instance, scope.accountId, scope.vaultId]);
