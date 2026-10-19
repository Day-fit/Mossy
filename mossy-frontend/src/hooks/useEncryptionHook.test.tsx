import { renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useAuthStore } from '../store/authStore.ts';
import { useEncryptionHook } from './useEncryptionHook.ts';

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

it('reuses an existing passkey by default and only registers on explicit creation', async () => {
    const results = { prf: { results: { first: new Uint8Array(32).buffer } } };
    const credentialId = new Uint8Array([1, 2, 3]).buffer;
    passkeys.getPasskey.mockResolvedValue({ results, credentialId });
    passkeys.registerPasskey.mockResolvedValue({ results, credentialId });
    const { result } = renderHook(useEncryptionHook);
    await expect(
        result.current.prepareProtection('vault-a', 'Vault A', {
            type: 'PRF', createNew: false, credentialId,
        })
    ).resolves.toMatchObject({ userId: 'user', type: 'PRF', credentialId });
    expect(passkeys.registerPasskey).not.toHaveBeenCalled();
    expect(passkeys.getPasskey).toHaveBeenCalledWith('vault-a', credentialId);
    await result.current.prepareProtection('vault-b', 'Vault B', { type: 'PRF', createNew: true });
    expect(passkeys.registerPasskey).toHaveBeenCalledOnce();
    expect(passkeys.registerPasskey).toHaveBeenCalledWith('vault-b', 'Vault B');
    expect(passkeys.getPasskey).toHaveBeenCalledOnce();
});
