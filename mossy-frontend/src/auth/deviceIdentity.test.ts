import { webcrypto } from 'node:crypto';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import type { IDBPDatabase } from 'idb';
import sodium from 'libsodium-wrappers-sumo';
import {
    deviceDbRef,
    ensureDeviceIdentity,
    loadDeviceIdentity,
    signNonce,
} from './deviceIdentity.ts';

const encode = (bytes: Uint8Array) =>
    sodium.to_base64(bytes, sodium.base64_variants.URLSAFE_NO_PADDING);
let records: Map<IDBValidKey, unknown>;
let add: ReturnType<typeof vi.fn>;
let put: ReturnType<typeof vi.fn>;
let transaction: ReturnType<typeof vi.fn>;

function legacy() {
    const pair = sodium.crypto_sign_keypair();
    const identity = {
        type: 'Ed25519',
        public: encode(pair.publicKey),
        private: encode(pair.privateKey),
    };
    return { identity, pair };
}

beforeAll(async () => {
    await sodium.ready;
});
beforeEach(async () => {
    vi.stubGlobal('crypto', webcrypto);
    const handles = await crypto.subtle.generateKey('Ed25519', false, [
        'sign',
        'verify',
    ]);
    vi.stubGlobal('CryptoKey', handles.privateKey.constructor);
    records = new Map();
    add = vi.fn(async (_store, value, key) => {
        records.set(key, structuredClone(value));
    });
    put = vi.fn();
    transaction = vi.fn((_store, mode) => {
        const next = new Map(records);
        const store = {
            getAllKeys: async () => [...records.keys()],
            getAll: async () =>
                [...records.values()].map((value) => structuredClone(value)),
            put: async (value: unknown, key: IDBValidKey) => {
                put(value, key);
                next.set(key, structuredClone(value));
            },
        };
        return {
            store,
            get done() {
                if (mode === 'readwrite') records = next;
                return Promise.resolve();
            },
        };
    });
    deviceDbRef.current = {
        get: async (_store: string, key: IDBValidKey) =>
            structuredClone(records.get(key)),
        add,
        transaction,
    } as unknown as IDBPDatabase;
});
afterEach(() => {
    deviceDbRef.current = null;
    vi.unstubAllGlobals();
});

it('creates a non-exportable signing key and reuses its stored handle after reload', async () => {
    const first = await ensureDeviceIdentity();
    expect(first.privateKey.extractable).toBe(false);
    expect(first.privateKey.usages).toEqual(['sign']);
    expect(first).not.toHaveProperty('private');
    await expect(
        crypto.subtle.exportKey('pkcs8', first.privateKey)
    ).rejects.toThrow();
    await expect(
        crypto.subtle.exportKey('jwk', first.privateKey)
    ).rejects.toThrow();
    const reloaded = await ensureDeviceIdentity();
    expect(reloaded.public).toBe(first.public);
    expect(add).toHaveBeenCalledTimes(1);
    const nonce = sodium.randombytes_buf(32);
    const signature = await signNonce(encode(nonce), reloaded);
    expect(
        sodium.crypto_sign_verify_detached(
            sodium.from_base64(
                signature,
                sodium.base64_variants.URLSAFE_NO_PADDING
            ),
            nonce,
            sodium.from_base64(
                first.public,
                sodium.base64_variants.URLSAFE_NO_PADDING
            )
        )
    ).toBe(true);
});

it('migrates current and legacy copies without changing the trusted public key or signature', async () => {
    const { identity, pair } = legacy();
    const other = legacy().identity;
    const vaultKey = {
        wrappedKey: new ArrayBuffer(40),
        salt: new Uint8Array(16),
    };
    records.set('current-device', identity);
    records.set('old-user', identity);
    records.set('other-user', other);
    records.set('vault', vaultKey);
    const native = await loadDeviceIdentity();
    expect(native?.public).toBe(identity.public);
    const nonce = sodium.randombytes_buf(32);
    expect(await signNonce(encode(nonce), native!)).toBe(
        encode(sodium.crypto_sign_detached(nonce, pair.privateKey))
    );
    for (const key of ['current-device', 'old-user', 'other-user']) {
        const stored = records.get(key) as {
            public: string;
            privateKey: CryptoKey;
        };
        expect(stored).not.toHaveProperty('private');
        expect(stored.privateKey.extractable).toBe(false);
        await expect(
            crypto.subtle.exportKey('jwk', stored.privateKey)
        ).rejects.toThrow();
    }
    expect(records.get('vault')).toEqual(vaultKey);
    expect(add).not.toHaveBeenCalled();
    const writes = put.mock.calls.length;
    await loadDeviceIdentity();
    expect(put).toHaveBeenCalledTimes(writes);
});

it.each([true, false])(
    'preserves the original legacy-user identity when explicitly selected: %s',
    async (explicit) => {
        const { identity } = legacy();
        records.set('old-user', identity);
        if (explicit) records.set('other-user', legacy().identity);
        const native = await loadDeviceIdentity(
            explicit ? 'old-user' : undefined
        );
        expect(native?.public).toBe(identity.public);
        expect(records.get('current-device')).not.toHaveProperty('private');
    }
);

it('converts ambiguous legacy identities without choosing or deleting either device identity', async () => {
    const first = legacy().identity;
    const second = legacy().identity;
    records.set('one', first);
    records.set('two', second);
    expect(await loadDeviceIdentity()).toBeNull();
    expect(records.has('current-device')).toBe(false);
    expect(records.get('one')).toMatchObject({ public: first.public });
    expect(records.get('two')).toMatchObject({ public: second.public });
    expect(records.get('one')).not.toHaveProperty('private');
    expect(records.get('two')).not.toHaveProperty('private');
});

it.each([
    'invalid seed',
    'mismatched public key',
    'unsupported import',
] as const)(
    'preserves all original records if migration fails: %s',
    async (failure) => {
        const { identity } = legacy();
        const broken = { ...identity };
        if (failure === 'invalid seed')
            broken.private = encode(new Uint8Array(12));
        if (failure === 'mismatched public key')
            broken.public = legacy().identity.public;
        if (failure === 'unsupported import')
            vi.spyOn(crypto.subtle, 'importKey').mockRejectedValue(
                new Error('Unsupported import')
            );
        records.set('current-device', broken);
        records.set('old-user', identity);
        await expect(ensureDeviceIdentity()).rejects.toThrow();
        expect(records.get('current-device')).toEqual(broken);
        expect(records.get('old-user')).toEqual(identity);
        expect(put).not.toHaveBeenCalled();
        expect(add).not.toHaveBeenCalled();
        vi.restoreAllMocks();
    }
);

it('rejects an exportable native private key without silently replacing the device identity', async () => {
    const pair = await crypto.subtle.generateKey('Ed25519', true, [
        'sign',
        'verify',
    ]);
    records.set('current-device', {
        type: 'Ed25519',
        public: 'public',
        privateKey: pair.privateKey,
    });
    await expect(ensureDeviceIdentity()).rejects.toThrow(
        'Invalid native device identity'
    );
    expect(add).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
});
