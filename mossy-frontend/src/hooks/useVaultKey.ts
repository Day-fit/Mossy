import { useAuthStore } from '../store/authStore.ts';
import type { VaultKeyMetadata } from '../types/vaultKey.ts';

export function useVaultKey() {
    const userDetails = useAuthStore((state) => state.userDetails);

    const registerPasskey = async () => {
        if (userDetails === null)
            throw new Error('User details not available.');

        const salt = crypto.getRandomValues(new Uint8Array(32));

        const cred = await navigator.credentials.create({
            publicKey: {
                rp: {
                    name: 'Mossy',
                    id: location.hostname,
                },
                challenge: crypto.getRandomValues(new Uint8Array(32)),
                user: {
                    // A new browser registration must not replace another
                    // browser's credential for the same account.
                    id: crypto.getRandomValues(new Uint8Array(32)),
                    name: userDetails.email,
                    displayName: userDetails.username,
                },
                pubKeyCredParams: [
                    { type: 'public-key', alg: -8 },
                    { type: 'public-key', alg: -7 },
                    { type: 'public-key', alg: -257 },
                ],
                extensions: {
                    prf: {
                        eval: {
                            first: salt,
                        },
                    },
                },
            },
        });

        if (!(cred instanceof PublicKeyCredential) || !cred) {
            throw new Error('Invalid credential');
        }

        const results = cred?.getClientExtensionResults();
        const isPrfNotSupported =
            !(results.prf && results.prf.enabled) ||
            !results.prf?.results?.first;

        if (isPrfNotSupported) {
            throw new Error('PRF is not supported');
        }

        return {
            credential: cred,
            salt: salt,
            metadata: {
                type: 'PRF',
                credentialId: cred.id,
                prfSalt: salt,
            } satisfies VaultKeyMetadata,
        };
    };

    const getPasskey = async (credentialId: string, salt: BufferSource) => {
        const cred = await navigator.credentials.get({
            publicKey: {
                challenge: crypto.getRandomValues(new Uint8Array(32)),
                allowCredentials: [
                    {
                        type: 'public-key',
                        id: Uint8Array.from(
                            atob(
                                credentialId
                                    .replace(/-/g, '+')
                                    .replace(/_/g, '/')
                            ),
                            (char) => char.charCodeAt(0)
                        ),
                    },
                ],
                rpId: location.hostname,
                userVerification: 'required',
                extensions: {
                    prf: {
                        eval: {
                            first: salt,
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
            throw new Error('PRF is not supported');
        }

        return results;
    };

    return {
        registerPasskey,
        getPasskey,
    };
}
