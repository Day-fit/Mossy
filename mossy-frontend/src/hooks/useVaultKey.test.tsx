import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useAuthStore } from '../store/authStore.ts';
import { useVaultKey } from './useVaultKey.ts';

const encoder = new TextEncoder();
const credentialId = new Uint8Array([1, 2, 3, 4]).buffer;
const prf = { prf: { enabled: true, results: { first: new Uint8Array(32).buffer } } };

class TestCredential {
    rawId = credentialId;
    response = { userHandle: encoder.encode('vault-a').buffer };
    getClientExtensionResults() { return prf; }
}

let previousCredentials: PropertyDescriptor | undefined;
const create = vi.fn();
const get = vi.fn();

beforeEach(() => {
    vi.resetAllMocks();
    previousCredentials = Object.getOwnPropertyDescriptor(navigator, 'credentials');
    Object.defineProperty(navigator, 'credentials', {
        configurable: true,
        value: { create, get },
    });
    vi.stubGlobal('PublicKeyCredential', TestCredential);
    useAuthStore.setState({
        userDetails: {
            userId: 'account-a',
            username: 'alice',
            email: null,
            grantedAuthorities: [],
        },
    });
    create.mockResolvedValue(new TestCredential());
    get.mockResolvedValue(new TestCredential());
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    if (previousCredentials) Object.defineProperty(navigator, 'credentials', previousCredentials);
    else Reflect.deleteProperty(navigator, 'credentials');
    useAuthStore.setState({ userDetails: null });
});

it('registers a credential labelled and derived for its vault', async () => {
    const { result } = renderHook(useVaultKey);
    const registered = await result.current.registerPasskey('vault-a', 'Personal vault');
    const options = create.mock.calls[0][0].publicKey;
    expect(new TextDecoder().decode(options.user.id)).toBe('vault-a');
    expect(options.user.name).toBe('Personal vault');
    expect(options.user.displayName).toBe('Personal vault');
    expect(new TextDecoder().decode(options.extensions.prf.eval.first))
        .toBe('mossy:encryption:v1:vault:vault-a');
    expect(registered.credentialId).toBe(credentialId);
});

it('uses the vault salt and saved credential ID even without a user handle', async () => {
    get.mockResolvedValueOnce(Object.assign(new TestCredential(), {
        response: { userHandle: null },
    }));
    const { result } = renderHook(useVaultKey);
    const selected = await result.current.getPasskey('vault-a', credentialId);
    const options = get.mock.calls[0][0].publicKey;
    expect(options.allowCredentials).toEqual([{ type: 'public-key', id: credentialId }]);
    expect(new TextDecoder().decode(options.extensions.prf.eval.first))
        .toBe('mossy:encryption:v1:vault:vault-a');
    expect(selected.credentialId).toBe(credentialId);
});

it('rejects another vault credential when selecting one without a saved ID', async () => {
    const { result } = renderHook(useVaultKey);
    await expect(result.current.getPasskey('vault-b')).rejects.toThrow(
        'The selected passkey belongs to a different vault.'
    );
});

it('does not call an absent user handle a different vault', async () => {
    get.mockResolvedValueOnce(Object.assign(new TestCredential(), {
        response: { userHandle: null },
    }));
    const { result } = renderHook(useVaultKey);
    await expect(result.current.getPasskey('vault-a')).rejects.toThrow(
        'Could not verify which vault this passkey belongs to.'
    );
});

it('rejects a credential that differs from the saved credential ID', async () => {
    const { result } = renderHook(useVaultKey);
    await expect(result.current.getPasskey('vault-a', new Uint8Array([9, 9, 9, 9]))).rejects.toThrow(
        'The selected passkey does not match this vault’s saved passkey.'
    );
});
