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
    expect(options.user.name).toBe('vault-a');
    expect(options.user.displayName).toBe('Personal vault');
    expect(new TextDecoder().decode(options.extensions.prf.eval.first))
        .toBe('mossy:encryption:v2:vault:vault-a');
    expect(registered.credentialId).toBe(credentialId);
});

it('uses the vault salt and limits unlock to the saved credential ID', async () => {
    const { result } = renderHook(useVaultKey);
    await result.current.getPasskey('vault-a', credentialId);
    const options = get.mock.calls[0][0].publicKey;
    expect(options.allowCredentials[0].id).toBe(credentialId);
    expect(new TextDecoder().decode(options.extensions.prf.eval.first))
        .toBe('mossy:encryption:v2:vault:vault-a');
});

it('rejects another vault credential when selecting one without a saved ID', async () => {
    const { result } = renderHook(useVaultKey);
    await expect(result.current.getPasskey('vault-b')).rejects.toThrow(
        'The selected passkey belongs to a different vault.'
    );
});

it('keeps the original account salt for older wrapped keys', async () => {
    const legacyCredential = new TestCredential();
    legacyCredential.response.userHandle = encoder.encode('account-a').buffer;
    get.mockResolvedValue(legacyCredential);
    const { result } = renderHook(useVaultKey);
    await result.current.getPasskey('vault-a', undefined, true);
    const options = get.mock.calls[0][0].publicKey;
    expect(new TextDecoder().decode(options.extensions.prf.eval.first))
        .toBe('mossy:encryption:v1:account-a');
});
