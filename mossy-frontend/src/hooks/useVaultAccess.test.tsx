import { useAuthStore } from '../store/authStore.ts';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KeyNotFoundException } from '../exception/KeyNotFoundException.ts';
import { useEncryptionStore } from '../store/encryptionStore.ts';
import { PrfNotSupportedError, useVaultAccess } from './useVaultAccess.ts';

const storage = vi.hoisted(() => ({
    saveKey: vi.fn(),
    loadKey: vi.fn(),
    getKeyMetadata: vi.fn(),
    getUserPasskey: vi.fn(),
    saveUserPasskey: vi.fn(),
}));
const prf = vi.hoisted(() => ({
    registerPasskey: vi.fn(),
    getPasskey: vi.fn(),
}));

vi.mock('./useKeyStorage.ts', () => ({ useKeyStorage: () => storage }));

vi.mock('./useVaultKey.ts', () => ({ useVaultKey: () => prf }));

const credentials = new Map<
    string,
    { type: 'UserPRF'; credentialId: string }
>();

function registered(credentialId = 'credential') {
    const salt = new Uint8Array(32).fill(4);
    return {
        credential: {
            id: credentialId,
            getClientExtensionResults: () => ({
                prf: { results: { first: new Uint8Array(32).fill(3) } },
            }),
        },
        salt,
        metadata: { type: 'PRF' as const, credentialId, prfSalt: salt },
    };
}

function switchUser(userId: string) {
    act(() =>
        useAuthStore.setState({
            userDetails: {
                userId,
                email: `${userId}@example.test`,
                username: userId,
                grantedAuthorities: [],
            },
        })
    );
}

beforeEach(() => {
    useAuthStore.setState({
        isAuthenticated: true,
        userDetails: {
            userId: 'user-one',
            email: 'one@example.test',
            username: 'One',
            grantedAuthorities: [],
        },
    });

    vi.resetAllMocks();
    credentials.clear();
    storage.getUserPasskey.mockImplementation(async () =>
        credentials.get(useAuthStore.getState().userDetails!.userId)
    );
    storage.saveUserPasskey.mockImplementation(async (credentialId: string) => {
        credentials.set(useAuthStore.getState().userDetails!.userId, {
            type: 'UserPRF',
            credentialId,
        });
    });
    prf.getPasskey.mockImplementation(async (_id, salt) => ({
        prf: { results: { first: new Uint8Array(salt) } },
    }));
    useEncryptionStore.setState({ passkeys: {} });
    vi.stubGlobal('PublicKeyCredential', class {});
    Object.defineProperty(navigator, 'credentials', {
        configurable: true,
        value: { create: vi.fn(), get: vi.fn() },
    });
    storage.getKeyMetadata.mockRejectedValue(
        new KeyNotFoundException('Key not found')
    );
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe('vault access', () => {
    it('persists a text key before marking the vault as unlocked', async () => {
        let finish!: () => void;
        storage.saveKey.mockImplementation(
            () =>
                new Promise<void>((resolve) => {
                    finish = resolve;
                })
        );
        const { result } = renderHook(() => useVaultAccess());

        const registration = result.current.registerVaultKey('vault', {
            type: 'Text',
            password: 'a vault password',
        });

        await vi.waitFor(() => expect(storage.saveKey).toHaveBeenCalledOnce());
        expect(
            useEncryptionStore.getState().getPasskey('vault')
        ).toBeUndefined();

        finish();
        await registration;

        const bytes = new TextEncoder().encode('a vault password');

        expect(storage.saveKey).toHaveBeenCalledWith('vault', bytes, {
            type: 'Text',
        });
        expect(useEncryptionStore.getState().getPasskey('vault')).toEqual(
            bytes
        );
    });

    it('does not replace an existing vault key', async () => {
        storage.getKeyMetadata.mockResolvedValue({ type: 'Text' });
        const { result } = renderHook(() => useVaultAccess());

        await expect(
            result.current.registerVaultKey('vault', { type: 'PRF' })
        ).rejects.toThrow('already has a key');
        expect(prf.registerPasskey).not.toHaveBeenCalled();
        expect(storage.saveKey).not.toHaveBeenCalled();
    });

    it('does not cache a key when saving fails', async () => {
        storage.saveKey.mockRejectedValue(new Error('Storage unavailable'));
        const { result } = renderHook(() => useVaultAccess());

        await expect(
            result.current.registerVaultKey('vault', {
                type: 'Text',
                password: 'a vault password',
            })
        ).rejects.toThrow('Storage unavailable');
        expect(
            useEncryptionStore.getState().getPasskey('vault')
        ).toBeUndefined();
    });

    it('uses the supplied PRF hook and saves only its returned metadata', async () => {
        const bytes = new Uint8Array(32).fill(3);
        const metadata = {
            type: 'PRF',
            credentialId: 'credential',
            prfSalt: new Uint8Array(32).fill(4),
        };
        prf.registerPasskey.mockResolvedValue({
            credential: {
                id: 'credential',
                getClientExtensionResults: () => ({
                    prf: { results: { first: bytes.buffer } },
                }),
            },
            salt: metadata.prfSalt,
            metadata,
        });
        const { result } = renderHook(() => useVaultAccess());

        await result.current.registerVaultKey('vault', { type: 'PRF' });

        expect(prf.registerPasskey).toHaveBeenCalledWith();
        expect(storage.saveKey).toHaveBeenCalledWith('vault', bytes, metadata);
        expect(useEncryptionStore.getState().getPasskey('vault')).toEqual(
            bytes
        );
    });

    it('prepares sync protection without saving a new vault key or unlocking the vault', async () => {
        const { result } = renderHook(() => useVaultAccess());

        await expect(
            result.current.prepareProtection('vault', {
                type: 'Text',
                password: 'a vault password',
            })
        ).resolves.toEqual({
            userId: 'user-one',
            passkey: new TextEncoder().encode('a vault password'),
            metadata: { type: 'Text' },
        });
        expect(storage.saveKey).not.toHaveBeenCalled();
        expect(
            useEncryptionStore.getState().getPasskey('vault')
        ).toBeUndefined();
    });

    it('validates a text password before caching it, and allows retrying a failed attempt', async () => {
        storage.getKeyMetadata.mockResolvedValue({ type: 'Text' });
        storage.loadKey
            .mockRejectedValueOnce(new Error('Invalid passkey'))
            .mockResolvedValue({});
        const { result } = renderHook(() => useVaultAccess());

        await expect(
            result.current.unlockVault('vault', 'wrong')
        ).rejects.toThrow('Invalid passkey');
        expect(
            useEncryptionStore.getState().getPasskey('vault')
        ).toBeUndefined();

        await result.current.unlockVault('vault', 'correct');

        expect(useEncryptionStore.getState().getPasskey('vault')).toEqual(
            new TextEncoder().encode('correct')
        );
    });

    it('unlocks PRF records using the stored credential id and evaluation salt', async () => {
        const salt = new Uint8Array(32).fill(1);
        const bytes = new Uint8Array(32).fill(2);
        storage.getKeyMetadata.mockResolvedValue({
            type: 'PRF',
            credentialId: 'credential',
            prfSalt: salt,
        });
        // Exercise a BufferSource view with a nonzero byte offset.
        prf.getPasskey.mockResolvedValue({
            prf: { results: { first: bytes.subarray(4, 20) } },
        });
        const { result } = renderHook(() => useVaultAccess());

        await result.current.unlockVault('vault');

        expect(prf.getPasskey).toHaveBeenCalledWith('credential', salt);
        expect(storage.loadKey).toHaveBeenCalledWith(
            'vault',
            bytes.slice(4, 20)
        );
        expect(useEncryptionStore.getState().getPasskey('vault')).toEqual(
            bytes.slice(4, 20)
        );
    });

    it('offers fallback for unsupported PRF while preserving cancellation errors', async () => {
        const { result } = renderHook(() => useVaultAccess());
        prf.registerPasskey.mockRejectedValueOnce(
            new Error('PRF is not supported')
        );

        await expect(
            result.current.prepareProtection('vault', { type: 'PRF' })
        ).rejects.toBeInstanceOf(PrfNotSupportedError);

        prf.registerPasskey.mockRejectedValueOnce(
            new DOMException('Cancelled', 'NotAllowedError')
        );

        await expect(
            result.current.prepareProtection('vault', { type: 'PRF' })
        ).rejects.toMatchObject({ name: 'NotAllowedError' });
        expect(storage.saveKey).not.toHaveBeenCalled();
    });

    it('rejects short setup passwords and cancelled operations before saving', async () => {
        const { result } = renderHook(() => useVaultAccess());

        await expect(
            result.current.prepareProtection('vault', {
                type: 'Text',
                password: 'short',
            })
        ).rejects.toThrow('at least 12 characters');

        const controller = new AbortController();
        controller.abort();

        await expect(
            result.current.registerVaultKey(
                'vault',
                { type: 'Text', password: 'a vault password' },
                controller.signal
            )
        ).rejects.toMatchObject({ name: 'AbortError' });
        expect(storage.saveKey).not.toHaveBeenCalled();
    });
    it('reuses the account credential after remounting and gives every vault a fresh salt', async () => {
        prf.registerPasskey.mockResolvedValue(registered());
        const firstHook = renderHook(() => useVaultAccess());
        await firstHook.result.current.registerVaultKey('vault-one', {
            type: 'PRF',
        });
        firstHook.unmount();

        const { result } = renderHook(() => useVaultAccess());
        await result.current.registerVaultKey('vault-two', { type: 'PRF' });
        await result.current.prepareProtection('vault-three', { type: 'PRF' });

        expect(prf.registerPasskey).toHaveBeenCalledOnce();
        expect(storage.saveUserPasskey).toHaveBeenCalledExactlyOnceWith(
            'credential'
        );
        expect(prf.getPasskey).toHaveBeenCalledTimes(2);
        const firstSalt = storage.saveKey.mock.calls[0][2].prfSalt;
        const secondSalt = storage.saveKey.mock.calls[1][2].prfSalt;
        const thirdSalt = prf.getPasskey.mock.calls[1][1];
        expect(secondSalt).toHaveLength(32);
        expect(secondSalt).not.toEqual(firstSalt);
        expect(thirdSalt).not.toEqual(secondSalt);
        expect(storage.saveKey.mock.calls[1][2].credentialId).toBe(
            'credential'
        );
    });

    it('creates separate credentials for two accounts and reuses the first after switching back', async () => {
        prf.registerPasskey
            .mockResolvedValueOnce(registered('one'))
            .mockResolvedValueOnce(registered('two'));
        const { result } = renderHook(() => useVaultAccess());
        await result.current.registerVaultKey('shared-vault', { type: 'PRF' });
        expect(
            useEncryptionStore.getState().getPasskey('shared-vault')
        ).toBeDefined();

        switchUser('user-two');
        expect(
            useEncryptionStore.getState().getPasskey('shared-vault')
        ).toBeUndefined();
        await result.current.prepareProtection('shared-vault', { type: 'PRF' });

        switchUser('user-one');
        await result.current.prepareProtection('another-vault', {
            type: 'PRF',
        });
        expect(prf.registerPasskey).toHaveBeenCalledTimes(2);
        expect(credentials.get('user-one')?.credentialId).toBe('one');
        expect(credentials.get('user-two')?.credentialId).toBe('two');
        expect(prf.getPasskey).toHaveBeenLastCalledWith(
            'one',
            expect.any(Uint8Array)
        );
    });

    it('serializes simultaneous setup so only one credential is created', async () => {
        prf.registerPasskey.mockResolvedValue(registered());
        const { result } = renderHook(() => useVaultAccess());
        const protections = await Promise.all([
            result.current.prepareProtection('one', { type: 'PRF' }),
            result.current.prepareProtection('two', { type: 'PRF' }),
        ]);
        expect(prf.registerPasskey).toHaveBeenCalledOnce();
        expect(prf.getPasskey).toHaveBeenCalledOnce();
        expect(protections[0].metadata).not.toEqual(protections[1].metadata);
    });

    it('keeps a registered credential for retry when saving the vault key fails', async () => {
        prf.registerPasskey.mockResolvedValue(registered());
        storage.saveKey.mockRejectedValueOnce(new Error('Storage full'));
        const { result } = renderHook(() => useVaultAccess());
        await expect(
            result.current.registerVaultKey('one', { type: 'PRF' })
        ).rejects.toThrow('Storage full');
        await result.current.registerVaultKey('one', { type: 'PRF' });
        expect(prf.registerPasskey).toHaveBeenCalledOnce();
        expect(prf.getPasskey).toHaveBeenCalledOnce();
    });

    it('never replaces an existing credential after cancellation or a failed lookup', async () => {
        credentials.set('user-one', { type: 'UserPRF', credentialId: 'saved' });
        prf.getPasskey.mockRejectedValueOnce(
            new DOMException('Cancelled', 'NotAllowedError')
        );
        const { result } = renderHook(() => useVaultAccess());
        await expect(
            result.current.prepareProtection('one', { type: 'PRF' })
        ).rejects.toMatchObject({ name: 'NotAllowedError' });
        storage.getUserPasskey.mockRejectedValueOnce(
            new Error('Storage unavailable')
        );
        await expect(
            result.current.prepareProtection('one', { type: 'PRF' })
        ).rejects.toThrow('Storage unavailable');
        expect(prf.registerPasskey).not.toHaveBeenCalled();
        expect(storage.saveUserPasskey).not.toHaveBeenCalled();
    });

    it('rejects native prompt completion after the account changes', async () => {
        let finish!: (value: ReturnType<typeof registered>) => void;
        prf.registerPasskey.mockReturnValue(
            new Promise((resolve) => {
                finish = resolve;
            })
        );
        const { result } = renderHook(() => useVaultAccess());
        const operation = result.current.registerVaultKey('one', {
            type: 'PRF',
        });
        const rejected = expect(operation).rejects.toThrow('account changed');
        await vi.waitFor(() =>
            expect(prf.registerPasskey).toHaveBeenCalledOnce()
        );
        switchUser('user-two');
        finish(registered());
        await rejected;
        expect(storage.saveUserPasskey).not.toHaveBeenCalled();
        expect(storage.saveKey).not.toHaveBeenCalled();
        expect(useEncryptionStore.getState().passkeys).toEqual({});
    });
});
