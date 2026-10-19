import { openDB } from 'idb';
import {
    scopeKey,
    type DeviceSigner,
    type Scope,
    type WrappedKeyRecord,
} from '@mossy/client-core';
const db = () =>
    openDB('mossy-extension-v2', 1, {
        upgrade(db) {
            db.createObjectStore('device');
            db.createObjectStore('wrapped');
        },
    });
export const wrappedKeys = {
    async read(scope: Scope): Promise<WrappedKeyRecord | undefined> {
        return (await db()).get('wrapped', scopeKey(scope));
    },
    async write(
        scope: Scope,
        record: WrappedKeyRecord,
        guard: () => void = () => {}
    ) {
        const database = await db();
        guard();
        await database.put('wrapped', record, scopeKey(scope));
    },
};
export async function deviceSigner(instance: string): Promise<DeviceSigner> {
    const database = await db();
    let pair = (await database.get('device', ['identity', instance])) as
        | CryptoKeyPair
        | undefined;
    if (!pair) {
        const generated = (await crypto.subtle.generateKey('Ed25519', false, [
            'sign',
            'verify',
        ])) as CryptoKeyPair;
        // add is race safe; concurrent contexts always reload the winner.
        try {
            await database.add('device', generated, ['identity', instance]);
        } catch {
            /* another context won */
        }
        pair = await database.get('device', ['identity', instance]);
    }
    if (
        !pair ||
        pair.privateKey.extractable ||
        pair.privateKey.algorithm.name !== 'Ed25519'
    )
        throw new Error('Invalid native device identity.');
    const keys = pair;
    return {
        async publicJwk() {
            const jwk = await crypto.subtle.exportKey('jwk', keys.publicKey);
            return { kty: 'OKP', crv: 'Ed25519', x: jwk.x! };
        },
        async sign(bytes) {
            return new Uint8Array(
                await crypto.subtle.sign(
                    'Ed25519',
                    keys.privateKey,
                    new Uint8Array(bytes)
                )
            );
        },
    };
}
export async function loadDeviceId(
    instance: string,
    identifier: string
): Promise<string | null> {
    return (
        (await (await db()).get('device', ['id', instance, identifier])) ?? null
    );
}
export async function saveDeviceId(
    instance: string,
    identifier: string,
    id: string
) {
    await (await db()).put('device', id, ['id', instance, identifier]);
}
/** Native key handles can cross only trusted packaged page/worker boundaries, never runtime IPC/content scripts. */
export async function signingHandles(instance: string): Promise<{
    privateKey: CryptoKey;
    publicJwk: import('@mossy/client-core').PublicIdentityJwk;
}> {
    await deviceSigner(instance);
    const pair = (await (
        await db()
    ).get('device', ['identity', instance])) as CryptoKeyPair;
    return {
        privateKey: pair.privateKey,
        publicJwk: await (await deviceSigner(instance)).publicJwk(),
    };
}
