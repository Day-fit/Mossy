import { prfInput as vaultSalt } from './vaultCrypto.ts';

const encoder = new TextEncoder();

function verifyVaultCredential(
    credential: PublicKeyCredential,
    vaultId: string,
    credentialId?: BufferSource
) {
    if (credentialId) {
        const expected =
            credentialId instanceof ArrayBuffer
                ? new Uint8Array(credentialId)
                : new Uint8Array(
                      credentialId.buffer,
                      credentialId.byteOffset,
                      credentialId.byteLength
                  );
        const actual = new Uint8Array(credential.rawId);

        const isDifferentCredential =
            actual.length !== expected.length ||
            actual.some((byte, index) => byte !== expected[index]);
        if (isDifferentCredential) {
            throw new Error(
                'The selected passkey does not match this vault’s saved passkey.'
            );
        }

        return;
    }

    const { userHandle } =
        credential.response as AuthenticatorAssertionResponse;

    if (!userHandle) {
        throw new Error(
            'Could not verify which vault this passkey belongs to.'
        );
    }

    const isDifferentVault = new TextDecoder().decode(userHandle) !== vaultId;
    if (isDifferentVault) {
        throw new Error('The selected passkey belongs to a different vault.');
    }
}

export function createVaultPasskeys(instance: string) {
    const hostname = new URL(instance).hostname;

    const registerPasskey = async (vaultId: string, vaultName: string) => {
        const cannotCreatePasskeys =
            typeof PublicKeyCredential === 'undefined' ||
            !navigator.credentials?.create;
        if (cannotCreatePasskeys) {
            throw new DOMException('PRF is not supported', 'NotSupportedError');
        }

        const cred = await navigator.credentials.create({
            publicKey: {
                rp: {
                    name: 'Mossy',
                    id: hostname,
                },
                challenge: crypto.getRandomValues(new Uint8Array(32)),
                user: {
                    id: encoder.encode(vaultId),
                    name: vaultName,
                    displayName: vaultName,
                },
                authenticatorSelection: {
                    residentKey: 'required',
                    userVerification: 'required',
                },
                pubKeyCredParams: [
                    { type: 'public-key', alg: -8 },
                    { type: 'public-key', alg: -7 },
                    { type: 'public-key', alg: -257 },
                ],
                extensions: {
                    prf: {
                        eval: {
                            first: vaultSalt(vaultId),
                        },
                    },
                },
            },
        });

        const isInvalidCredential = !(cred instanceof PublicKeyCredential);
        if (isInvalidCredential) {
            throw new Error('Invalid credential');
        }

        const results = cred.getClientExtensionResults();

        if (!results.prf?.enabled) {
            throw new DOMException('PRF is not supported', 'NotSupportedError');
        }

        return {
            credentialId: cred.rawId,
            results: results.prf?.results?.first
                ? results
                : (await getPasskey(vaultId, cred.rawId)).results,
        };
    };

    const getPasskey = async (vaultId: string, credentialId?: BufferSource) => {
        const cannotGetPasskeys =
            typeof PublicKeyCredential === 'undefined' ||
            !navigator.credentials?.get;
        if (cannotGetPasskeys) {
            throw new DOMException('PRF is not supported', 'NotSupportedError');
        }

        const cred = await navigator.credentials.get({
            publicKey: {
                challenge: crypto.getRandomValues(new Uint8Array(32)),
                allowCredentials: credentialId
                    ? [{ type: 'public-key', id: credentialId }]
                    : undefined,
                rpId: hostname,
                userVerification: 'required',
                extensions: {
                    prf: {
                        eval: {
                            first: vaultSalt(vaultId),
                        },
                    },
                },
            },
        });

        const isInvalidCredential = !(cred instanceof PublicKeyCredential);
        if (isInvalidCredential) {
            throw new Error('Invalid credential');
        }

        verifyVaultCredential(cred, vaultId, credentialId);

        const results = cred.getClientExtensionResults();

        if (!results.prf?.results?.first) {
            throw new DOMException('PRF is not supported', 'NotSupportedError');
        }

        return { results, credentialId: cred.rawId };
    };

    return {
        registerPasskey,
        getPasskey,
    };
}
