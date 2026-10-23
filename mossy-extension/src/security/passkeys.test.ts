import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authorizePrf, registerPrf } from './passkeys';

const credentialId = new Uint8Array([1, 2, 3, 4]).buffer;
const prf = new Uint8Array(32).fill(7);

class Credential {
    rawId = credentialId;
    response = {
        userHandle: new TextEncoder().encode('vault-a')
            .buffer as ArrayBuffer | null,
    };
    getClientExtensionResults = () => ({
        prf: { enabled: true, results: { first: prf.buffer } },
    });
}

const get = vi.fn();
const create = vi.fn();

beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('PublicKeyCredential', Credential);
    vi.stubGlobal('navigator', { credentials: { get, create } });
    get.mockResolvedValue(new Credential());
    create.mockResolvedValue(new Credential());
});

afterEach(() => vi.unstubAllGlobals());

describe('main vault passkey flow in the extension', () => {
    it('uses the configured RP, vault salt and saved credential ID', async () => {
        get.mockResolvedValueOnce(
            Object.assign(new Credential(), { response: { userHandle: null } })
        );

        expect(
            await authorizePrf('https://vault.example', 'vault-a', credentialId)
        ).toEqual({ prf, credentialId });

        const options = get.mock.calls[0]![0].publicKey;

        expect(options.rpId).toBe('vault.example');
        expect(options.userVerification).toBe('required');
        expect(options.allowCredentials).toEqual([
            { type: 'public-key', id: credentialId },
        ]);
        expect(
            new TextDecoder().decode(options.extensions.prf.eval.first)
        ).toBe('mossy:encryption:v1:vault:vault-a');
        expect(create).not.toHaveBeenCalled();
    });
    it('verifies the vault user handle when no credential ID is available', async () => {
        await expect(
            authorizePrf('https://vault.example', 'vault-a')
        ).resolves.toEqual({ prf, credentialId });
        await expect(
            authorizePrf('https://vault.example', 'vault-b')
        ).rejects.toThrow('different vault');

        expect(create).not.toHaveBeenCalled();
    });
    it('rejects a missing user handle without a saved ID', async () => {
        get.mockResolvedValueOnce(
            Object.assign(new Credential(), { response: { userHandle: null } })
        );

        await expect(
            authorizePrf('https://vault.example', 'vault-a')
        ).rejects.toThrow('Could not verify');
    });
    it('rejects a mismatched saved credential ID, including offset buffer views', async () => {
        await expect(
            authorizePrf(
                'https://vault.example',
                'vault-a',
                new Uint8Array([9])
            )
        ).rejects.toThrow('saved passkey');

        const view = new Uint8Array([0, 1, 2, 3, 4, 0]).subarray(1, 5);

        await expect(
            authorizePrf('https://vault.example', 'vault-a', view)
        ).resolves.toEqual({ prf, credentialId });
    });
    it('registers only explicitly, with the vault ID and name', async () => {
        await expect(
            registerPrf('https://vault.example', 'vault-a', 'Personal vault')
        ).resolves.toEqual({ prf, credentialId });

        const options = create.mock.calls[0]![0].publicKey;

        expect(options.rp).toEqual({ name: 'Mossy', id: 'vault.example' });
        expect(new TextDecoder().decode(options.user.id)).toBe('vault-a');
        expect(options.user.name).toBe('Personal vault');
        expect(options.user.displayName).toBe('Personal vault');
        expect(options.authenticatorSelection).toEqual({
            residentKey: 'required',
            userVerification: 'required',
        });
        expect(
            new TextDecoder().decode(options.extensions.prf.eval.first)
        ).toBe('mossy:encryption:v1:vault:vault-a');
        expect(get).not.toHaveBeenCalled();
    });
    it('retrieves PRF results using the new credential if registration only reports support', async () => {
        create.mockResolvedValueOnce(
            Object.assign(new Credential(), {
                getClientExtensionResults: () => ({ prf: { enabled: true } }),
            })
        );

        await expect(
            registerPrf('https://vault.example', 'vault-a', 'Personal vault')
        ).resolves.toEqual({ prf, credentialId });

        expect(get.mock.calls[0]![0].publicKey.allowCredentials).toEqual([
            { type: 'public-key', id: credentialId },
        ]);
    });
    it.each(['get', 'create'])(
        'preserves %s cancellation without fallback',
        async (operation) => {
            const error = new DOMException('Canceled', 'NotAllowedError');
            (operation === 'get' ? get : create).mockRejectedValueOnce(error);

            await expect(
                operation === 'get'
                    ? authorizePrf('https://vault.example', 'vault-a')
                    : registerPrf(
                          'https://vault.example',
                          'vault-a',
                          'Personal vault'
                      )
            ).rejects.toBe(error);

            expect(operation === 'get' ? create : get).not.toHaveBeenCalled();
        }
    );
    it('does not substitute registration for a passkey without PRF', async () => {
        get.mockResolvedValueOnce(
            Object.assign(new Credential(), {
                getClientExtensionResults: () => ({}),
            })
        );

        await expect(
            authorizePrf('https://vault.example', 'vault-a')
        ).rejects.toThrow('does not support PRF');

        expect(create).not.toHaveBeenCalled();
    });
});
