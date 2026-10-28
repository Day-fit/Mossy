import type { Page } from '@playwright/test';
import type { NativeIdentity } from '../../src/storage/deviceIdentity';
import {
    encryptWithKey,
    passwordWrappingKey,
} from '../../src/security/vaultCrypto';

export const instance = 'https://mossy.dayfit.pl';
export const extensionId = 'amkfdcmiegnfjnaidcoaojapakdcchoj';
export const vaultPassword = 'correct vault password';

export async function createVaultFixture() {
    const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
    const rawKey = Array.from(
        new Uint8Array(await crypto.subtle.exportKey('raw', key))
    );

    const wrapping = await passwordWrappingKey(
        vaultPassword,
        new Uint8Array(16).fill(7)
    );
    const wrapped = Array.from(
        new Uint8Array(
            await crypto.subtle.wrapKey('raw', key, wrapping, 'AES-KW')
        )
    );
    const ciphertext = await encryptWithKey(
        JSON.stringify({
            kind: 'PASSWORD',
            password: 'fixture-secret-password',
        }),
        key
    );

    return { rawKey, wrapped, ciphertext };
}

export type VaultFixture = Awaited<ReturnType<typeof createVaultFixture>>;

export async function seed(page: Page, wrapped: number[]) {
    await page.evaluate(
        async ({ instance, wrapped }) => {
            const database = await new Promise<IDBDatabase>(
                (resolve, reject) => {
                    const request = indexedDB.open('mossy-extension-v2', 1);
                    request.onupgradeneeded = () => {
                        const needsDeviceStore =
                            !request.result.objectStoreNames.contains('device');
                        if (needsDeviceStore) {
                            request.result.createObjectStore('device');
                        }

                        const needsWrappedKeyStore =
                            !request.result.objectStoreNames.contains(
                                'wrapped'
                            );
                        if (needsWrappedKeyStore) {
                            request.result.createObjectStore('wrapped');
                        }
                    };
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                }
            );
            const identity = await crypto.subtle.generateKey('Ed25519', false, [
                'sign',
                'verify',
            ]);
            const transaction = database.transaction(
                ['device', 'wrapped'],
                'readwrite'
            );
            transaction
                .objectStore('device')
                .put(identity, ['identity', instance]);
            transaction
                .objectStore('device')
                .put('device-1', ['id', instance, 'alice']);
            transaction.objectStore('wrapped').put(
                {
                    type: 'Password',
                    salt: new Uint8Array(16).fill(7),
                    wrappedKey: new Uint8Array(wrapped).buffer,
                },
                JSON.stringify([
                    instance,
                    'user-1',
                    '10000000-0000-4000-8000-000000000001',
                ])
            );

            await new Promise<void>((resolve, reject) => {
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            });
            database.close();
        },
        { instance, wrapped }
    );
}

export async function peerIdentity(): Promise<NativeIdentity> {
    const pair = (await crypto.subtle.generateKey('Ed25519', false, [
        'sign',
        'verify',
    ])) as CryptoKeyPair;
    const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
    return {
        privateKey: pair.privateKey,
        publicJwk: { kty: 'OKP', crv: 'Ed25519', x: jwk.x! },
    };
}
