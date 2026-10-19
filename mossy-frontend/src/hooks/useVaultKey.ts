import { useAuthStore } from '../store/authStore.ts';

export function useVaultKey() {
    const userDetails = useAuthStore((state) => state.userDetails);
    const encoder = new TextEncoder();
    const vaultSalt = (vaultId: string) =>
        encoder.encode(`mossy:encryption:v2:vault:${vaultId}`);
    const legacyUserSalt = (userId: string) =>
        encoder.encode(`mossy:encryption:v1:${userId}`);

    const registerPasskey = async (vaultId: string, vaultName: string) => {
        if (userDetails === null)
            throw new Error('User details not available.');
        if (typeof PublicKeyCredential === 'undefined' || !navigator.credentials?.create)
            throw new DOMException('PRF is not supported', 'NotSupportedError');

        const cred = await navigator.credentials.create({
            publicKey: {
                rp: {
                    name: 'Mossy',
                    id: location.hostname,
                },
                challenge: crypto.getRandomValues(new Uint8Array(32)),
                user: {
                    id: encoder.encode(vaultId),
                    name: vaultId,
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

        if (!(cred instanceof PublicKeyCredential) || !cred) {
            throw new Error('Invalid credential');
        }

        const results = cred.getClientExtensionResults();
        const isPrfNotSupported = !(results.prf && results.prf.enabled);

        if (isPrfNotSupported) {
            throw new DOMException('PRF is not supported', 'NotSupportedError');
        }

        return {
            credential: cred,
            credentialId: cred.rawId,
            results: results.prf?.results?.first
                ? results
                : (await getPasskey(vaultId, cred.rawId)).results,
            metadata: {
                type: 'PRF',
            },
        };
    };

    const getPasskey = async (
        vaultId: string,
        credentialId?: BufferSource,
        legacy = false
    ) => {
        if (userDetails === null)
            throw new Error('User details not available.');
        if (typeof PublicKeyCredential === 'undefined' || !navigator.credentials?.get)
            throw new DOMException('PRF is not supported', 'NotSupportedError');
        const cred = await navigator.credentials.get({
            publicKey: {
                challenge: crypto.getRandomValues(new Uint8Array(32)),
                allowCredentials: credentialId
                    ? [{ type: 'public-key', id: credentialId }]
                    : undefined,
                rpId: location.hostname,
                userVerification: 'required',
                extensions: {
                    prf: {
                        eval: {
                            first: legacy
                                ? legacyUserSalt(userDetails.userId)
                                : vaultSalt(vaultId),
                        },
                    },
                },
            },
        });

        if (!(cred instanceof PublicKeyCredential) || !cred) {
            throw new Error('Invalid credential');
        }

        const expectedHandle = legacy ? userDetails.userId : vaultId;
        const response = cred.response as AuthenticatorAssertionResponse;
        if (
            !credentialId &&
            (!response.userHandle ||
                new TextDecoder().decode(response.userHandle) !== expectedHandle)
        ) {
            throw new Error('The selected passkey belongs to a different vault.');
        }

        const results = cred?.getClientExtensionResults();
        const isPrfNotSupported = !results.prf?.results?.first;

        if (isPrfNotSupported) {
            throw new DOMException('PRF is not supported', 'NotSupportedError');
        }

        return { results, credentialId: cred.rawId };
    };

    return {
        registerPasskey,
        getPasskey,
    };
}
