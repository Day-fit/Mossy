import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useAuthStore } from '../store/authStore.ts';
import { useVaultKey } from './useVaultKey.ts';

class Credential {
    readonly id: string;

    constructor(id: string) {
        this.id = id;
    }

    getClientExtensionResults(): AuthenticationExtensionsClientOutputs {
        return {
            prf: {
                enabled: true,
                results: { first: new Uint8Array(32).fill(1) },
            },
        };
    }
}

const create =
    vi.fn<(options: CredentialCreationOptions) => Promise<Credential>>();
const get = vi.fn<(options: CredentialRequestOptions) => Promise<Credential>>();
const savedPasskeys = new Map<string, Credential>();

beforeEach(() => {
    vi.resetAllMocks();
    savedPasskeys.clear();
    vi.stubGlobal('PublicKeyCredential', Credential);
    Object.defineProperty(navigator, 'credentials', {
        configurable: true,
        value: { create, get },
    });
    useAuthStore.setState({
        userDetails: {
            userId: 'account-one',
            email: 'mossy@example.test',
            username: 'Mossy',
            grantedAuthorities: [],
        },
    });
    let sequence = 0;
    create.mockImplementation(async ({ publicKey }) => {
        if (!publicKey) throw new Error('Public key options missing');
        const handle = Array.from(publicKey.user.id as Uint8Array).join(',');
        const credential = new Credential(btoa(`credential-${++sequence}`));
        // Model authenticators replacing an existing credential for the same RP/user handle.
        savedPasskeys.set(`${publicKey.rp.id}:${handle}`, credential);
        return credential;
    });
    get.mockImplementation(async ({ publicKey }) => {
        const bytes = publicKey?.allowCredentials?.[0]?.id as Uint8Array;
        const id = btoa(String.fromCharCode(...bytes));
        const credential = [...savedPasskeys.values()].find(
            (value) => value.id === id
        );
        if (!credential)
            throw new DOMException('Passkey was replaced', 'NotAllowedError');
        return credential;
    });
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'credentials');
});

it('labels browser registrations for the account and keeps different browser credentials distinct', async () => {
    const { result } = renderHook(() => useVaultKey());

    const first = await result.current.registerPasskey();
    const second = await result.current.registerPasskey();
    await result.current.registerPasskey();

    expect(savedPasskeys.size).toBe(3);
    await expect(
        result.current.getPasskey(first.credential.id, first.salt)
    ).resolves.toMatchObject({
        prf: { results: { first: expect.any(Uint8Array) } },
    });
    await expect(
        result.current.getPasskey(second.credential.id, second.salt)
    ).resolves.toMatchObject({
        prf: { results: { first: expect.any(Uint8Array) } },
    });

    const users = create.mock.calls.map(([options]) => options.publicKey!.user);

    expect(users.every((user) => user.id.byteLength === 32)).toBe(true);
    expect(users[0].name).toBe('mossy@example.test');
    expect(users[1].name).toBe('mossy@example.test');
    expect(users[0].displayName).toBe('Mossy');
    expect(users[1].displayName).toBe('Mossy');
});

it('requires an account before creating a passkey', async () => {
    useAuthStore.setState({ userDetails: null });
    const { result } = renderHook(() => useVaultKey());

    await expect(result.current.registerPasskey()).rejects.toThrow(
        'User details not available'
    );
    expect(create).not.toHaveBeenCalled();
});
