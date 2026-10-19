import { prfInput, prfBytes } from '@mossy/client-core';
export async function authorizePrf(
    instance: string,
    userId: string
): Promise<Uint8Array<ArrayBuffer>> {
    if (
        !navigator.credentials?.get ||
        typeof PublicKeyCredential === 'undefined'
    )
        throw new Error('Passkeys are unavailable in this browser.');
    const credential = await navigator.credentials.get({
        publicKey: {
            rpId: new URL(instance).hostname,
            challenge: crypto.getRandomValues(new Uint8Array(32)),
            userVerification: 'required',
            extensions: { prf: { eval: { first: prfInput(userId) } } },
        },
    });
    if (!(credential instanceof PublicKeyCredential))
        throw new Error('Passkey authorization was canceled.');
    // get only: never register or silently substitute password protection.
    return prfBytes(credential.getClientExtensionResults());
}
