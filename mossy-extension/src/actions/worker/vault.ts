import {
    passwordWrappingKey,
    importWrappingKey,
    unwrapVaultKey,
    encryptWithKey,
    decryptWithKey,
} from '../../security/vaultCrypto';
import { parseSecretPayload } from '../secretPayload';
import type { KeyProtection, UnlockInput } from './types';

// This module is loaded only inside the action's dedicated worker.
let key: CryptoKey | undefined;

export function clearVaultKey() {
    key = undefined;
}

export async function wrappingKey(
    protection: KeyProtection,
    password: string,
    prf?: Uint8Array<ArrayBuffer>
): Promise<CryptoKey> {
    if (protection.type === 'Password') {
        return passwordWrappingKey(password, protection.salt);
    }
    if (!prf) {
        throw new Error('Authorize with a passkey first.');
    }
    return importWrappingKey(prf);
}

export async function unlock(input: UnlockInput): Promise<void> {
    const wrapping = await wrappingKey(input.record, input.password, input.prf);
    key = await unwrapVaultKey(input.record, wrapping, input.extractable);
}

export async function read(input: { ciphertext: string }): Promise<string> {
    if (!key) throw new Error('Authorize this action first.');
    const payload = parseSecretPayload(
        await decryptWithKey(input.ciphertext, key)
    );
    if (payload.kind !== 'PASSWORD') {
        throw new Error('Only passwords can be used here.');
    }
    return payload.password;
}

export async function encrypt(input: { password: string }): Promise<string> {
    if (!key) throw new Error('Authorize this action first.');
    return encryptWithKey(
        JSON.stringify({ kind: 'PASSWORD', password: input.password }),
        key
    );
}

export async function exportVaultKey(): Promise<Uint8Array<ArrayBuffer>> {
    if (!key?.extractable)
        throw new Error('Authorize vault key transfer first.');
    try {
        return new Uint8Array(await crypto.subtle.exportKey('raw', key));
    } finally {
        clearVaultKey();
    }
}
