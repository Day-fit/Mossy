import { useAuthStore } from '../store/authStore.ts';

export function useVaultKey() {
    const userDetails = useAuthStore((state) => state.userDetails);
    const encoder = new TextEncoder();
    const userSalt = (userId: string) => encoder.encode(`mossy:encryption:v1:${userId}`);

    const registerPasskey = async () => {
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
                    id: encoder.encode(userDetails.userId),
                    name: userDetails.username,
                    displayName: userDetails.username,
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
                            // Reusing the same passkey gives the same PRF output across browsers.
                            first: userSalt(userDetails.userId),
                        },
                    },
                },
            },
        });

        if (!(cred instanceof PublicKeyCredential) || !cred) {
            throw new Error('Invalid credential');
        }

        const results = cred.getClientExtensionResults();
        const isPrfNotSupported =
            !(results.prf && results.prf.enabled);

        if (isPrfNotSupported) {
            throw new DOMException('PRF is not supported', 'NotSupportedError');
        }

        return {
            credential: cred,
            results: results.prf?.results?.first ? results : await getPasskey(cred.rawId),
            metadata: {
                type: 'PRF',
            },
        };
    };

    const getPasskey = async (credentialId?: BufferSource) => {
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
                            first: userSalt(userDetails.userId),
                        },
                    },
                },
            },
        });

        if (!(cred instanceof PublicKeyCredential) || !cred) {
            throw new Error('Invalid credential');
        }

        const results = cred?.getClientExtensionResults();
        const isPrfNotSupported = !results.prf?.results?.first;

        if (isPrfNotSupported) {
            throw new DOMException('PRF is not supported', 'NotSupportedError');
        }

        return results;
    };

    return {
        registerPasskey,
        getPasskey,
    };
}
