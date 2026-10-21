import type { PublicIdentityJwk } from 'mossy-api-client';
import { openDatabase } from './database';

export type NativeIdentity = {
    privateKey: CryptoKey;
    publicJwk: PublicIdentityJwk;
};

export async function signingHandles(
    instance: string
): Promise<NativeIdentity> {
    const database = await openDatabase();
    let pair = (await database.get('device', ['identity', instance])) as
        | CryptoKeyPair
        | undefined;

    if (!pair) {
        const generated = (await crypto.subtle.generateKey('Ed25519', false, [
            'sign',
            'verify',
        ])) as CryptoKeyPair;
        try {
            await database.add('device', generated, ['identity', instance]);
        } catch {
            // Another extension context may have created the identity first.
        }
        pair = await database.get('device', ['identity', instance]);
    }

    const identity = pair;
    const isInvalidIdentity =
        !identity ||
        identity.privateKey.extractable ||
        identity.privateKey.algorithm.name !== 'Ed25519';
    if (isInvalidIdentity) {
        throw new Error('Invalid native device identity.');
    }

    const jwk = await crypto.subtle.exportKey('jwk', identity.publicKey);
    return {
        privateKey: identity.privateKey,
        publicJwk: { kty: 'OKP', crv: 'Ed25519', x: jwk.x! },
    };
}

export async function signNonce(
    nonce: string,
    identity: NativeIdentity
): Promise<string> {
    const bytes = Uint8Array.from(
        atob(nonce.replaceAll('-', '+').replaceAll('_', '/')),
        (character) => character.charCodeAt(0)
    );
    const signature = new Uint8Array(
        await crypto.subtle.sign('Ed25519', identity.privateKey, bytes)
    );
    return btoa(
        Array.from(signature, (byte) => String.fromCharCode(byte)).join('')
    )
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replaceAll('=', '');
}

export async function loadDeviceId(
    instance: string,
    identifier: string
): Promise<string | null> {
    return (
        (await (
            await openDatabase()
        ).get('device', ['id', instance, identifier])) ?? null
    );
}

export async function saveDeviceId(
    instance: string,
    identifier: string,
    id: string
) {
    await (
        await openDatabase()
    ).put('device', id, ['id', instance, identifier]);
}
