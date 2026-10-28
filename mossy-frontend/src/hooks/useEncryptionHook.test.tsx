import { renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useAuthStore } from '../store/authStore.ts';
import { getKeyMetadata, useEncryptionHook } from './useEncryptionHook.ts';

const passwordHash = vi.hoisted(() => vi.fn());
vi.mock('libsodium-wrappers-sumo', () => ({
    default: {
        ready: Promise.resolve(),
        crypto_pwhash: passwordHash,
        crypto_pwhash_OPSLIMIT_MODERATE: 3,
        crypto_pwhash_MEMLIMIT_MODERATE: 268435456,
        crypto_pwhash_ALG_ARGON2ID13: 2,
        memzero: (bytes: Uint8Array) => bytes.fill(0),
    },
}));

const passkeys = vi.hoisted(() => ({
    getPasskey: vi.fn(),
    registerPasskey: vi.fn(),
}));
const database = vi.hoisted(() => ({
    getDeviceDatabase: vi.fn(),
}));
vi.mock('./useVaultKey.ts', () => ({ useVaultKey: () => passkeys }));
vi.mock('./useDeviceKeys.ts', () => ({ useDeviceKeys: vi.fn() }));
vi.mock('../auth/deviceIdentity.ts', () => database);

beforeEach(() => {
    vi.resetAllMocks();
    passwordHash.mockReturnValue(new Uint8Array(32).fill(9));
    useAuthStore.setState({
        userDetails: {
            userId: 'user',
            username: 'mossy',
            email: null,
            grantedAuthorities: [],
        },
    });
    vi.stubGlobal('crypto', {
        subtle: {
            importKey: vi.fn().mockResolvedValue({ type: 'secret' }),
            generateKey: vi.fn().mockResolvedValue({ type: 'data-key' }),
            wrapKey: vi.fn().mockResolvedValue(new ArrayBuffer(40)),
            unwrapKey: vi.fn().mockResolvedValue({ type: 'data-key' }),
        },
    });
});

it('stores the vault credential ID and requires it when unlocking', async () => {
    const credentialId = new Uint8Array([1, 2, 3]).buffer;
    const results = { prf: { results: { first: new Uint8Array(32).buffer } } };
    const add = vi.fn();
    const get = vi.fn().mockResolvedValue({
        type: 'PRF', credentialId, wrappedKey: new ArrayBuffer(40),
    });
    database.getDeviceDatabase.mockResolvedValue({ add, get });
    passkeys.registerPasskey.mockResolvedValue({ results, credentialId });
    passkeys.getPasskey.mockResolvedValue({ results, credentialId });
    const { result } = renderHook(useEncryptionHook);
    const protection = await result.current.prepareProtection('vault-a', 'Vault A', {
        type: 'PRF', createNew: true,
    });
    expect(passkeys.registerPasskey).toHaveBeenCalledWith('vault-a', 'Vault A');
    await result.current.registerVaultKey('vault-a', protection);
    expect(add).toHaveBeenCalledWith('keys', expect.objectContaining({
        type: 'PRF', credentialId,
    }), 'vault-a');
    await result.current.unlockVault('vault-a');
    expect(passkeys.getPasskey).toHaveBeenCalledWith('vault-a', credentialId);
});

it('saves a synced vault method with its wrapped key', async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    database.getDeviceDatabase.mockResolvedValue({ put });
    const { result } = renderHook(useEncryptionHook);
    const protection = {
        type: 'Password' as const,
        userId: 'user',
        salt: new Uint8Array(16),
        wrappingKey: {} as CryptoKey,
    };
    await result.current.saveRawKey('vault-a', protection, new Uint8Array(32));
    expect(put).toHaveBeenCalledWith('keys', expect.objectContaining({
        type: 'Password',
    }), 'vault-a');
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    useAuthStore.setState({ userDetails: null });
});

it('propagates canceled selection without automatically creating a passkey', async () => {
    const canceled = new DOMException('Canceled', 'NotAllowedError');
    passkeys.getPasskey.mockRejectedValue(canceled);
    const { result } = renderHook(useEncryptionHook);
    await expect(
        result.current.prepareProtection('vault-a', 'Vault A', { type: 'PRF', createNew: false })
    ).rejects.toBe(canceled);
    expect(passkeys.registerPasskey).not.toHaveBeenCalled();
});

it('uses the transferred credential ID without registering another passkey', async () => {
    const results = { prf: { results: { first: new Uint8Array(32).buffer } } };
    const credentialId = new Uint8Array([1, 2, 3]).buffer;
    passkeys.getPasskey.mockResolvedValue({ results, credentialId });
    const { result } = renderHook(useEncryptionHook);
    await expect(
        result.current.prepareProtection('vault-a', 'Vault A', {
            type: 'PRF', createNew: false, credentialId,
        })
    ).resolves.toMatchObject({ userId: 'user', type: 'PRF', credentialId });
    expect(passkeys.registerPasskey).not.toHaveBeenCalled();
    expect(passkeys.getPasskey).toHaveBeenCalledWith('vault-a', credentialId);
});

it('migrates an untyped password record in place and unlocks the original wrapped key', async () => {
    const wrappedKey = new Uint8Array(40).fill(17).buffer;
    const salt = new Uint8Array(16).fill(7);
    let stored: unknown = { wrappedKey, salt };
    const get = vi.fn(async () => stored);
    const put = vi.fn(async (_store, value) => {
        stored = value;
    });
    database.getDeviceDatabase.mockResolvedValue({ get, put });
    const { result } = renderHook(useEncryptionHook);

    await expect(getKeyMetadata('legacy-vault')).resolves.toEqual({
        type: 'Password',
    });
    expect(put).toHaveBeenCalledExactlyOnceWith(
        'keys',
        { type: 'Password', wrappedKey, salt },
        'legacy-vault'
    );
    expect((stored as { wrappedKey: ArrayBuffer }).wrappedKey).toBe(wrappedKey);
    expect((stored as { salt: Uint8Array }).salt).toBe(salt);
    await expect(
        result.current.getKeyMetadata('legacy-vault')
    ).resolves.toEqual({ type: 'Password' });
    expect(put).toHaveBeenCalledTimes(1);
    await result.current.unlockVault(
        'legacy-vault',
        'the original vault password'
    );
    expect(passwordHash).toHaveBeenCalledWith(
        32,
        'the original vault password',
        salt,
        3,
        268435456,
        2
    );
    expect(crypto.subtle.unwrapKey).toHaveBeenCalledWith(
        'raw',
        wrappedKey,
        expect.anything(),
        'AES-KW',
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
    expect(crypto.subtle.generateKey).not.toHaveBeenCalled();
    expect(crypto.subtle.wrapKey).not.toHaveBeenCalled();
    expect(passkeys.getPasskey).not.toHaveBeenCalled();
});

it.each([
    { wrappedKey: new ArrayBuffer(40), salt: new Uint8Array(16), type: 'PRF' },
    {
        wrappedKey: new ArrayBuffer(40),
        salt: new Uint8Array(16),
        type: 'unknown',
    },
    { wrappedKey: new ArrayBuffer(40), salt: 'invalid salt' },
])(
    'does not reinterpret malformed or explicitly tagged records as legacy passwords',
    async (record) => {
        const put = vi.fn();
        database.getDeviceDatabase.mockResolvedValue({
            get: vi.fn().mockResolvedValue(record),
            put,
        });
        await expect(getKeyMetadata('invalid-vault')).rejects.toThrow(
            'Vault key not found'
        );
        expect(put).not.toHaveBeenCalled();
    }
);
