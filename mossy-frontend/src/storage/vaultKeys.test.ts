import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { keyStorage } from './vaultKeys.ts';
import { useAuthStore } from '../store/authStore.ts';
import { useEncryptionStore } from '../store/encryptionStore.ts';
import type { StoredVaultKey } from '../types/vaultKey.ts';
import { vaultKeyId } from './keyIds.ts';

const database = vi.hoisted(() => ({
    get: vi.fn(),
    put: vi.fn(),
    add: vi.fn(),
}));
vi.mock('../auth/deviceIdentity.ts', () => ({
    getDeviceDatabase: async () => database,
}));
const records = new Map<string, StoredVaultKey>();
const passkey = new Uint8Array(32).fill(7);
const metadata = {
    type: 'PRF',
    credentialId: 'Y3JlZA',
    prfSalt: new Uint8Array(32),
} as const;
function login(userId: string) {
    useAuthStore.setState({
        isAuthenticated: true,
        userDetails: {
            userId,
            email: `${userId}@test.com`,
            username: userId,
            grantedAuthorities: [],
        },
    });
}
beforeEach(() => {
    vi.resetAllMocks();
    records.clear();
    vi.stubGlobal('crypto', webcrypto);
    login('one');
    useEncryptionStore.getState().clearPasskeys();
    database.get.mockImplementation(async (_store, id) => records.get(id));
    database.put.mockImplementation(async (_store, value, id) =>
        records.set(id, value)
    );
    database.add.mockImplementation(async (_store, value, id) => {
        if (records.has(id))
            throw new DOMException('Exists', 'ConstraintError');
        records.set(id, value);
    });
});
afterEach(() => vi.unstubAllGlobals());

it('round-trips imported bytes with HKDF and rejects a wrong PRF value', async () => {
    const raw = new Uint8Array(32).fill(42);
    const derive = vi.spyOn(crypto.subtle, 'deriveKey');
    await keyStorage.saveRawKey('vault', passkey, raw, metadata);
    expect(derive).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'HKDF', hash: 'SHA-256' }),
        expect.anything(),
        { name: 'AES-KW', length: 256 },
        false,
        ['wrapKey', 'unwrapKey']
    );
    derive.mockRestore();
    expect(
        new Uint8Array(records.get(vaultKeyId('one', 'vault'))!.wrappedKey)
    ).not.toEqual(raw);
    expect(await keyStorage.getKeyMetadata('vault')).toEqual(metadata);
    const key = await keyStorage.loadKey('vault', passkey);
    expect(new Uint8Array(await crypto.subtle.exportKey('raw', key))).toEqual(
        raw
    );
    useEncryptionStore.getState().setPasskey('vault', new Uint8Array(32));
    await expect(
        keyStorage.loadKey('vault', new Uint8Array(32))
    ).rejects.toThrow('Invalid passkey');
    expect(useEncryptionStore.getState().getPasskey('vault')).toBeUndefined();
});

it('isolates account keys and refuses duplicate vault registration', async () => {
    const first = new Uint8Array(32).fill(1),
        second = new Uint8Array(32).fill(2);
    await keyStorage.saveRawKey('shared', passkey, first, metadata);
    await expect(
        keyStorage.saveKey('shared', passkey, metadata)
    ).rejects.toMatchObject({ name: 'ConstraintError' });
    login('two');
    await expect(keyStorage.getKeyMetadata('shared')).rejects.toThrow(
        'Key not found'
    );
    await keyStorage.saveRawKey('shared', passkey, second, metadata);
    const key = await keyStorage.loadKey('shared', passkey);
    expect(new Uint8Array(await crypto.subtle.exportKey('raw', key))).toEqual(
        second
    );
    login('one');
    const original = await keyStorage.loadKey('shared', passkey);
    expect(
        new Uint8Array(await crypto.subtle.exportKey('raw', original))
    ).toEqual(first);
});

it('clears cached keys on locking, logout, and account change', async () => {
    const key = await keyStorage.saveKey('vault', passkey, metadata);
    const store = useEncryptionStore.getState();
    store.setUnlocked('vault', passkey, key, 'one');
    expect(useEncryptionStore.getState().getKey('vault')).toBe(key);
    store.clearPasskey('vault');
    expect(useEncryptionStore.getState().getKey('vault')).toBeUndefined();
    store.setUnlocked('vault', passkey, key, 'one');
    useAuthStore.setState({ isAuthenticated: false });
    expect(useEncryptionStore.getState().keys).toEqual({});
    login('one');
    store.setUnlocked('vault', passkey, key, 'one');
    login('two');
    expect(useEncryptionStore.getState().keys).toEqual({});
});
