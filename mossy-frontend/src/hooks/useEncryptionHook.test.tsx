import { renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useAuthStore } from '../store/authStore.ts';
import { useEncryptionHook } from './useEncryptionHook.ts';

const passkeys = vi.hoisted(() => ({
    getPasskey: vi.fn(),
    registerPasskey: vi.fn(),
}));
vi.mock('./useVaultKey.ts', () => ({ useVaultKey: () => passkeys }));
vi.mock('./useDeviceKeys.ts', () => ({ useDeviceKeys: vi.fn() }));
vi.mock('../auth/deviceIdentity.ts', () => ({ getDeviceDatabase: vi.fn() }));

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
        subtle: { importKey: vi.fn().mockResolvedValue({ type: 'secret' }) },
    });
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
        result.current.prepareProtection({ type: 'PRF' })
    ).rejects.toBe(canceled);
    expect(passkeys.registerPasskey).not.toHaveBeenCalled();
});

it('reuses an existing passkey by default and only registers on explicit creation', async () => {
    const results = { prf: { results: { first: new Uint8Array(32).buffer } } };
    passkeys.getPasskey.mockResolvedValue(results);
    passkeys.registerPasskey.mockResolvedValue({ results });
    const { result } = renderHook(useEncryptionHook);
    await expect(
        result.current.prepareProtection({ type: 'PRF' })
    ).resolves.toMatchObject({ userId: 'user', type: 'PRF' });
    expect(passkeys.registerPasskey).not.toHaveBeenCalled();
    await result.current.prepareProtection({ type: 'PRF', createNew: true });
    expect(passkeys.registerPasskey).toHaveBeenCalledOnce();
    expect(passkeys.getPasskey).toHaveBeenCalledOnce();
});
