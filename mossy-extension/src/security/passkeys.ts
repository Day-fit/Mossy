import { createVaultPasskeys } from './vaultPasskeys';
import { prfBytes, PrfNotSupportedError } from './vaultCrypto';

async function protection(
    ceremony: Promise<{
        results: AuthenticationExtensionsClientOutputs;
        credentialId: ArrayBuffer;
    }>
) {
    try {
        const passkey = await ceremony;

        return {
            prf: prfBytes(passkey.results),
            credentialId: passkey.credentialId,
        };
    } catch (error) {
        if (
            error instanceof DOMException &&
            error.name === 'NotSupportedError'
        ) {
            throw new PrfNotSupportedError();
        }

        throw error;
    }
}

// Platform adapter for main's vault-specific ceremonies. Registration is always explicit.
export function authorizePrf(
    instance: string,
    vaultId: string,
    credentialId?: BufferSource
) {
    return protection(
        createVaultPasskeys(instance).getPasskey(vaultId, credentialId)
    );
}

export function registerPrf(
    instance: string,
    vaultId: string,
    vaultName: string
) {
    return protection(
        createVaultPasskeys(instance).registerPasskey(vaultId, vaultName)
    );
}
