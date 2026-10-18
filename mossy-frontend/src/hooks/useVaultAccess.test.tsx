import { webcrypto } from 'node:crypto';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useAuthStore } from '../store/authStore.ts';
import { useEncryptionStore } from '../store/encryptionStore.ts';
import { PrfNotSupportedError, useVaultAccess } from './useVaultAccess.ts';
import { useEncryptionHook } from './useEncryptionHook.ts';
import { userPasskeyId, vaultKeyId } from '../storage/keyIds.ts';
import type { DeviceDatabase } from '../auth/deviceIdentity.ts';

const database = vi.hoisted(() => ({
    get: vi.fn(),
    add: vi.fn(),
    put: vi.fn(),
}));
vi.mock('../auth/deviceIdentity.ts', () => ({
    getDeviceDatabase: async () => database,
}));
const records = new Map<string, DeviceDatabase['keys']['value']>();
const create =
    vi.fn<(options: CredentialCreationOptions) => Promise<Credential>>();
const get = vi.fn<(options: CredentialRequestOptions) => Promise<Credential>>();
class Credential {
    id = btoa('credential');
    response: { userHandle: ArrayBuffer | null } = { userHandle: null };
    private output: AuthenticationExtensionsClientOutputs;
    constructor(
        output: AuthenticationExtensionsClientOutputs = {
            prf: { enabled: true },
        }
    ) {
        this.output = output;
    }
    getClientExtensionResults() {
        return this.output;
    }
}
function switchUser(userId: string) {
    act(() =>
        useAuthStore.setState({
            isAuthenticated: true,
            userDetails: {
                userId,
                email: `${userId}@test.com`,
                username: userId,
                grantedAuthorities: [],
            },
        })
    );
}
let owner = '';
let sequence = 0;
beforeEach(() => {
    vi.resetAllMocks();
    owner = `user-${++sequence}`;
    switchUser(owner);
    useEncryptionStore.getState().clearPasskeys();
    records.clear();
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('PublicKeyCredential', Credential);
    Object.defineProperty(navigator, 'credentials', {
        configurable: true,
        value: { create, get },
    });
    // Model the browser-wide exclusive lock, including queued cancellation.
    let tail = Promise.resolve();
    Object.defineProperty(navigator, 'locks', {
        configurable: true,
        value: {
            request: vi.fn((_name, options, operation) => {
                const result = tail.then(() => {
                    options.signal?.throwIfAborted();
                    return operation();
                });
                tail = result.then(
                    () => {},
                    () => {}
                );
                return result;
            }),
        },
    });
    database.get.mockImplementation(async (_store, id) => records.get(id));
    database.add.mockImplementation(async (_store, value, id) => {
        if (records.has(id))
            throw new DOMException('Exists', 'ConstraintError');
        records.set(id, value);
    });
    database.put.mockImplementation(async (_store, value, id) =>
        records.set(id, value)
    );
    create.mockResolvedValue(new Credential());
    get.mockResolvedValue(
        new Credential({
            prf: { results: { first: new Uint8Array(32).fill(7) } },
        })
    );
});
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'credentials');
    Reflect.deleteProperty(navigator, 'locks');
});

it('accepts enabled-only registration, reuses one credential for concurrent vaults, and caches the unlocked key', async () => {
    const { result } = renderHook(() => ({
        access: useVaultAccess(),
        encryption: useEncryptionHook(),
    }));
    await Promise.all([
        result.current.access.registerVaultKey('one', { type: 'PRF' }),
        result.current.access.registerVaultKey('two', { type: 'PRF' }),
    ]);
    expect(create).toHaveBeenCalledOnce();
    expect(get).toHaveBeenCalledTimes(2);
    expect(records.get(userPasskeyId(owner))).toEqual({
        type: 'UserPRF',
        credentialId: btoa('credential'),
    });
    const one = records.get(vaultKeyId(owner, 'one'));
    const two = records.get(vaultKeyId(owner, 'two'));
    expect(one).toMatchObject({
        type: 'PRF',
        credentialId: btoa('credential'),
    });
    expect(two).toMatchObject({
        type: 'PRF',
        credentialId: btoa('credential'),
    });
    expect(one).not.toEqual(two);
    useEncryptionStore.getState().clearPasskeys();
    const unwrap = vi.spyOn(crypto.subtle, 'unwrapKey');
    await result.current.access.unlockVault('one');
    const encrypted = await result.current.encryption.encrypt('secret', 'one');
    expect(await result.current.encryption.decrypt(encrypted, 'one')).toBe(
        'secret'
    );
    expect(unwrap).toHaveBeenCalledOnce();
    unwrap.mockRestore();
    switchUser('other');
    expect(useEncryptionStore.getState().getKey('one')).toBeUndefined();
    expect(useEncryptionStore.getState().getPasskey('one')).toBeUndefined();
});

it('uses an immediate PRF output without a second native prompt', async () => {
    create.mockResolvedValueOnce(
        new Credential({
            prf: { enabled: true, results: { first: new Uint8Array(32) } },
        })
    );
    const { result } = renderHook(useVaultAccess);
    await result.current.registerVaultKey('one', { type: 'PRF' });
    expect(get).not.toHaveBeenCalled();
});

it('registers, unlocks, and encrypts with a vault password without creating a passkey', async () => {
    const password = 'a long vault password';
    const { result } = renderHook(() => ({
        access: useVaultAccess(),
        encryption: useEncryptionHook(),
    }));

    await expect(
        result.current.access.registerVaultKey('password-vault', {
            type: 'Text',
            password: 'short',
        })
    ).rejects.toThrow('at least 12 characters');
    await result.current.access.registerVaultKey('password-vault', {
        type: 'Text',
        password,
    });
    expect(create).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
    expect(await result.current.access.getKeyMetadata('password-vault')).toEqual({ type: 'Text' });

    useEncryptionStore.getState().clearPasskeys();
    await expect(result.current.access.unlockVault('password-vault', 'wrong password')).rejects.toThrow(
        'Invalid vault password'
    );
    await result.current.access.unlockVault('password-vault', password);
    const ciphertext = await result.current.encryption.encrypt('secret', 'password-vault');
    expect(await result.current.encryption.decrypt(ciphertext, 'password-vault')).toBe('secret');
    expect(create).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
});

it('retains the credential when saving its ID fails and retries without creating another', async () => {
    database.put.mockRejectedValueOnce(new Error('Storage full'));
    const { result } = renderHook(useVaultAccess);
    await expect(
        result.current.registerVaultKey('one', { type: 'PRF' })
    ).rejects.toThrow('Storage full');
    expect(records.get(userPasskeyId(owner))).toMatchObject({
        type: 'PendingPRF',
        userHandle: expect.any(Uint8Array),
    });
    await result.current.registerVaultKey('one', { type: 'PRF' });
    expect(create).toHaveBeenCalledOnce();
    expect(get).toHaveBeenCalledOnce();
});

it('persists ownership for the initiating account when it changes during native creation', async () => {
    let finish!: (value: Credential) => void;
    create.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                finish = resolve;
            })
    );
    const { result } = renderHook(useVaultAccess);
    const pending = result.current.registerVaultKey('one', { type: 'PRF' });
    const rejected = expect(pending).rejects.toThrow('account changed');
    await vi.waitFor(() => expect(create).toHaveBeenCalledOnce());
    const originalOwner = owner;
    switchUser('other');
    finish(new Credential());
    await rejected;
    expect(records.get(userPasskeyId(originalOwner))).toMatchObject({
        type: 'UserPRF',
    });
    expect(records.has(vaultKeyId('other', 'one'))).toBe(false);
    switchUser(originalOwner);
    await result.current.registerVaultKey('one', { type: 'PRF' });
    expect(create).toHaveBeenCalledOnce();
});

it('reuses the credential after vault storage or PRF evaluation fails', async () => {
    get.mockRejectedValueOnce(new DOMException('Cancelled', 'NotAllowedError'));
    const { result } = renderHook(useVaultAccess);
    await expect(
        result.current.registerVaultKey('one', { type: 'PRF' })
    ).rejects.toThrow('Cancelled');
    database.add.mockRejectedValueOnce(new Error('Storage full'));
    await expect(
        result.current.registerVaultKey('one', { type: 'PRF' })
    ).rejects.toThrow('Storage full');
    await result.current.registerVaultKey('one', { type: 'PRF' });
    expect(create).toHaveBeenCalledOnce();
});

it.each(['create', 'get'] as const)(
    'aborts native %s and releases the lock',
    async (operation) => {
        const controller = new AbortController();
        if (operation === 'get')
            records.set(userPasskeyId(owner), {
                type: 'UserPRF',
                credentialId: btoa('credential'),
            });
        const native = operation === 'create' ? create : get;
        native.mockImplementationOnce(
            (options) =>
                new Promise((_resolve, reject) => {
                    options.signal!.addEventListener(
                        'abort',
                        () => reject(options.signal!.reason),
                        { once: true }
                    );
                })
        );
        const { result } = renderHook(useVaultAccess);
        const pending = result.current.prepareProtection(
            'one',
            { type: 'PRF' },
            controller.signal
        );
        const rejected = expect(pending).rejects.toMatchObject({
            name: 'AbortError',
        });
        await vi.waitFor(() => expect(native).toHaveBeenCalledOnce());
        expect(native.mock.calls[0][0].signal).toBe(controller.signal);
        controller.abort();
        await rejected;
        // The lock is available after cancellation; creation remains blocked when
        // the browser did not return enough information to recover its outcome.
        const retry = result.current.prepareProtection('one', { type: 'PRF' });
        if (operation === 'create')
            await expect(retry).rejects.toThrow('earlier registration');
        else await expect(retry).resolves.toHaveProperty('passkey');
    }
);

it('does not create after an ambiguous reservation, unsupported PRF, failed lookup, or missing browser-wide locks', async () => {
    const { result } = renderHook(useVaultAccess);
    records.set(userPasskeyId(owner), {
        type: 'PendingPRF',
        userHandle: new Uint8Array(32),
    });
    await expect(
        result.current.prepareProtection('one', { type: 'PRF' })
    ).rejects.toThrow('earlier registration');
    records.clear();
    database.get.mockRejectedValueOnce(new Error('Storage unavailable'));
    await expect(
        result.current.prepareProtection('one', { type: 'PRF' })
    ).rejects.toThrow('Storage unavailable');
    expect(create).not.toHaveBeenCalled();
    create.mockResolvedValueOnce(new Credential({}));
    await expect(
        result.current.prepareProtection('one', { type: 'PRF' })
    ).rejects.toBeInstanceOf(PrfNotSupportedError);
    await result.current.prepareProtection('one', { type: 'PRF' });
    expect(create).toHaveBeenCalledOnce();
    Reflect.deleteProperty(navigator, 'locks');
    await expect(
        result.current.prepareProtection('one', { type: 'PRF' })
    ).rejects.toThrow('Web Locks');
    expect(create).toHaveBeenCalledOnce();
});

it('recovers ownership from a durable reservation after losing the in-memory result', async () => {
    const handle = new Uint8Array(32).fill(9);
    records.set(userPasskeyId(owner), {
        type: 'PendingPRF',
        userHandle: handle,
    });
    const recovered = new Credential({
        prf: { results: { first: new Uint8Array(32).fill(7) } },
    });
    recovered.response.userHandle = handle.buffer;
    get.mockResolvedValueOnce(recovered);
    const { result } = renderHook(useVaultAccess);
    await result.current.registerVaultKey('one', { type: 'PRF' });
    expect(create).not.toHaveBeenCalled();
    expect(get.mock.calls[0][0].publicKey?.allowCredentials).toBeUndefined();
    expect(records.get(userPasskeyId(owner))).toEqual({
        type: 'UserPRF',
        credentialId: recovered.id,
    });
    expect(useEncryptionStore.getState().getKey('one')).toBeDefined();
});

it('keeps credentials separate across accounts and reuses them after switching back', async () => {
    const { result } = renderHook(useVaultAccess);
    const originalOwner = owner;
    await result.current.prepareProtection('one', { type: 'PRF' });
    switchUser('another-account');
    await result.current.prepareProtection('one', { type: 'PRF' });
    switchUser(originalOwner);
    await result.current.prepareProtection('two', { type: 'PRF' });
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0].publicKey!.user.id).not.toEqual(
        create.mock.calls[1][0].publicKey!.user.id
    );
    expect(create.mock.calls[0][0].publicKey!.user.name).toBe(
        `${originalOwner}@test.com`
    );
});
