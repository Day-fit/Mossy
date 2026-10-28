import { openDB, type IDBPDatabase } from 'idb';
import sodium from 'libsodium-wrappers-sumo';

export type CryptoPair = {
    type: 'Ed25519';
    public: string;
    privateKey: CryptoKey;
};

const CURRENT_IDENTITY_KEY = 'current-device';
const DEVICE_ID_KEY_PREFIX = 'deviceId:';
const CURRENT_DEVICE_ACCOUNT_KEY = 'currentDeviceAccount';

export const deviceDbRef: { current: IDBPDatabase | null } = {
    current: null,
};

let dbInitializationPromise: Promise<IDBPDatabase> | null = null;

export async function getDeviceDatabase(): Promise<IDBPDatabase> {
    if (deviceDbRef.current) return deviceDbRef.current;

    if (!dbInitializationPromise) {
        dbInitializationPromise = openDB('mossy', 2, {
            upgrade(db) {
                if (!db.objectStoreNames.contains('keys')) {
                    db.createObjectStore('keys');
                }
                if (!db.objectStoreNames.contains('device')) {
                    db.createObjectStore('device');
                }
            },
        }).then((db) => {
            deviceDbRef.current = db;
            return db;
        });
    }

    return dbInitializationPromise;
}

function isDeviceIdentity(
    value: unknown
): value is { type: 'Ed25519'; public: string } {
    return (
        !!value &&
        typeof value === 'object' &&
        'type' in value &&
        value.type === 'Ed25519' &&
        'public' in value &&
        typeof value.public === 'string'
    );
}

function nativeIdentity(value: unknown): CryptoPair | undefined {
    if (!isDeviceIdentity(value) || !('privateKey' in value)) return undefined;
    const key = value.privateKey;
    if (
        !(key instanceof CryptoKey) ||
        key.type !== 'private' ||
        key.extractable ||
        key.algorithm.name !== 'Ed25519' ||
        !key.usages.includes('sign')
    ) {
        throw new Error('Invalid native device identity.');
    }
    return { type: 'Ed25519', public: value.public, privateKey: key };
}

async function migrateIdentity(value: unknown): Promise<CryptoPair> {
    const native = nativeIdentity(value);
    if (native) return native;
    if (
        !isDeviceIdentity(value) ||
        !('private' in value) ||
        typeof value.private !== 'string'
    ) {
        throw new Error('Invalid local device identity.');
    }
    await sodium.ready;
    const bytes = sodium.from_base64(
        value.private,
        sodium.base64_variants.URLSAFE_NO_PADDING
    );
    try {
        if (bytes.length !== sodium.crypto_sign_SECRETKEYBYTES)
            throw new Error('Invalid local device identity.');
        const privateKey = await crypto.subtle.importKey(
            'jwk',
            {
                kty: 'OKP',
                crv: 'Ed25519',
                x: value.public,
                d: sodium.to_base64(
                    bytes.subarray(0, 32),
                    sodium.base64_variants.URLSAFE_NO_PADDING
                ),
            },
            'Ed25519',
            false,
            ['sign']
        );
        const publicKey = await crypto.subtle.importKey(
            'jwk',
            { kty: 'OKP', crv: 'Ed25519', x: value.public },
            'Ed25519',
            true,
            ['verify']
        );
        // Verify the imported seed against the trusted public identity before replacing storage.
        const proof = await crypto.subtle.sign(
            'Ed25519',
            privateKey,
            new Uint8Array()
        );
        if (
            !(await crypto.subtle.verify(
                'Ed25519',
                publicKey,
                proof,
                new Uint8Array()
            ))
        )
            throw new Error(
                'The stored device identity does not match its public key.'
            );
        return { type: 'Ed25519', public: value.public, privateKey };
    } finally {
        sodium.memzero(bytes);
    }
}

export async function loadDeviceIdentity(
    legacyUserId?: string
): Promise<CryptoPair | null> {
    const db = await getDeviceDatabase();
    const current: unknown = await db.get('keys', CURRENT_IDENTITY_KEY);
    const native = nativeIdentity(current);
    if (native) return native;
    if (current && !isDeviceIdentity(current))
        throw new Error('Invalid local device identity.');

    const reading = db.transaction('keys', 'readonly');
    const [keys, values] = await Promise.all([
        reading.store.getAllKeys(),
        reading.store.getAll(),
    ]);
    await reading.done;
    const identities = await Promise.all(
        values
            .flatMap((value, index) =>
                isDeviceIdentity(value) ? [{ key: keys[index], value }] : []
            )
            .map(async (entry) => ({
                key: entry.key,
                identity: await migrateIdentity(entry.value),
            }))
    );
    const selected =
        identities.find(({ key }) => key === CURRENT_IDENTITY_KEY) ??
        identities.find(({ key }) => key === legacyUserId) ??
        (identities.length === 1 ? identities[0] : undefined);
    if (identities.length) {
        // Keep every legacy identity usable while removing all raw private-key copies atomically.
        const writing = db.transaction('keys', 'readwrite');
        await Promise.all([
            ...identities.map(({ key, identity }) =>
                writing.store.put(identity, key)
            ),
            ...(selected
                ? [writing.store.put(selected.identity, CURRENT_IDENTITY_KEY)]
                : []),
            writing.done,
        ]);
    }
    return selected?.identity ?? null;
}

export async function ensureDeviceIdentity(): Promise<CryptoPair> {
    const stored = await loadDeviceIdentity();
    if (stored) return stored;
    const pair = await crypto.subtle.generateKey('Ed25519', false, [
        'sign',
        'verify',
    ]);
    const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
    if (!publicJwk.x)
        throw new Error('Could not export the device public key.');
    const identity: CryptoPair = {
        type: 'Ed25519',
        public: publicJwk.x,
        privateKey: pair.privateKey,
    };
    const db = await getDeviceDatabase();
    try {
        await db.add('keys', identity, CURRENT_IDENTITY_KEY);
    } catch (error) {
        if (
            !(error instanceof DOMException) ||
            error.name !== 'ConstraintError'
        )
            throw error;
        const existing = await loadDeviceIdentity();
        if (!existing) throw error;
        return existing;
    }
    return identity;
}

function deviceIdKey(accountIdentifier: string): string {
    return `${DEVICE_ID_KEY_PREFIX}${accountIdentifier}`;
}

export async function loadStoredDeviceId(
    accountIdentifier?: string
): Promise<string | null> {
    const db = await getDeviceDatabase();
    const account =
        accountIdentifier ??
        ((await db.get('device', CURRENT_DEVICE_ACCOUNT_KEY)) as
            | string
            | undefined);
    if (!account) return null;

    if (accountIdentifier) {
        await db.put('device', accountIdentifier, CURRENT_DEVICE_ACCOUNT_KEY);
    }

    return (
        ((await db.get('device', deviceIdKey(account))) as
            | string
            | undefined) ?? null
    );
}

export async function storeDeviceId(
    deviceId: string,
    accountIdentifier: string
): Promise<void> {
    const db = await getDeviceDatabase();
    const transaction = db.transaction('device', 'readwrite');
    await Promise.all([
        transaction.store.put(deviceId, deviceIdKey(accountIdentifier)),
        transaction.store.put(accountIdentifier, CURRENT_DEVICE_ACCOUNT_KEY),
        transaction.done,
    ]);
}

export async function signDeviceTranscript(
    identity: CryptoPair,
    transcript: Uint8Array
): Promise<Uint8Array> {
    if (!nativeIdentity(identity))
        throw new Error('Invalid native device identity.');
    return new Uint8Array(
        await crypto.subtle.sign(
            'Ed25519',
            identity.privateKey,
            new Uint8Array(transcript)
        )
    );
}

export async function signNonce(
    nonce: string,
    identity: CryptoPair
): Promise<string> {
    await sodium.ready;
    const signature = await signDeviceTranscript(
        identity,
        sodium.from_base64(nonce, sodium.base64_variants.URLSAFE_NO_PADDING)
    );
    return sodium.to_base64(
        signature,
        sodium.base64_variants.URLSAFE_NO_PADDING
    );
}
