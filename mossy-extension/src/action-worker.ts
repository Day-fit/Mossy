import {
    passwordWrappingKey,
    importWrappingKey,
    unwrapVaultKey,
    encryptWithKey,
    decryptWithKey,
    parseSecretPayload,
    createReceiverOffer,
    encryptVaultKey,
    decryptVaultKey,
    type WrappedKeyRecord,
    type DeviceSigner,
    type TransferContext,
    type VaultKeyResponse,
    type PublicIdentityJwk,
} from '@mossy/client-core';
// This worker has exactly one lifetime/action. Ordinary vault keys are nonextractable.
let key: CryptoKey | undefined;
let wrapping: CryptoKey | undefined;
let privateDh: Uint8Array | undefined;
function nativeSigner(
    privateKey: CryptoKey,
    publicJwk: PublicIdentityJwk
): DeviceSigner {
    return {
        publicJwk: async () => publicJwk,
        sign: async (bytes) =>
            new Uint8Array(
                await crypto.subtle.sign(
                    'Ed25519',
                    privateKey,
                    new Uint8Array(bytes)
                )
            ),
    };
}
self.onmessage = async ({ data }) => {
    const { id, kind, ...input } = data;
    try {
        let result: unknown;
        if (kind === 'unlock') {
            wrapping =
                input.record.type === 'Password'
                    ? await passwordWrappingKey(
                          input.password,
                          input.record.salt
                      )
                    : await importWrappingKey(new Uint8Array(input.prf));
            input.password = '';
            input.prf?.fill(0);
            key = await unwrapVaultKey(
                input.record as WrappedKeyRecord,
                wrapping!,
                input.extractable === true
            );
            wrapping = undefined;
        } else if (kind === 'read') {
            if (!key) throw new Error('Authorize this action first.');
            const payload = parseSecretPayload(
                await decryptWithKey(input.ciphertext, key)
            );
            if (payload.kind !== 'PASSWORD')
                throw new Error('Only passwords can be used here.');
            result = payload.password;
        } else if (kind === 'encrypt') {
            if (!key) throw new Error('Authorize this action first.');
            result = await encryptWithKey(
                JSON.stringify({ kind: 'PASSWORD', password: input.password }),
                key
            );
            input.password = '';
        } else if (kind === 'offer') {
            const offer = await createReceiverOffer(
                input.deviceId,
                input.vaultId,
                nativeSigner(input.privateKey, input.publicJwk)
            );
            privateDh = offer.privateDh;
            result = offer.receiver;
        } else if (kind === 'send') {
            if (!key || !key.extractable)
                throw new Error('Authorize vault key transfer first.');
            const raw = new Uint8Array(
                await crypto.subtle.exportKey('raw', key)
            );
            try {
                result = await encryptVaultKey(
                    raw,
                    input.context as TransferContext,
                    input.deviceId,
                    nativeSigner(input.privateKey, input.publicJwk)
                );
            } finally {
                raw.fill(0);
                key = undefined;
            }
        } else if (kind === 'receive') {
            if (!privateDh) throw new Error('Sync offer expired.');
            // Local protection is obtained only after the encrypted transfer arrives.
            wrapping =
                input.protection.type === 'Password'
                    ? await passwordWrappingKey(
                          input.password,
                          input.protection.salt
                      )
                    : await importWrappingKey(new Uint8Array(input.prf));
            input.password = '';
            input.prf?.fill(0);
            const raw = await decryptVaultKey(
                input.transfer as VaultKeyResponse,
                input.context as TransferContext,
                privateDh,
                input.senderIdentity as PublicIdentityJwk
            );
            try {
                const received = await crypto.subtle.importKey(
                    'raw',
                    raw,
                    { name: 'AES-GCM' },
                    true,
                    ['encrypt', 'decrypt']
                );
                const wrappedKey = await crypto.subtle.wrapKey(
                    'raw',
                    received,
                    wrapping!,
                    'AES-KW'
                );
                result =
                    input.protection.type === 'Password'
                        ? {
                              type: 'Password',
                              salt: input.protection.salt,
                              wrappedKey,
                          }
                        : { type: 'PRF', wrappedKey };
            } finally {
                raw.fill(0);
                privateDh.fill(0);
                privateDh = undefined;
                wrapping = undefined;
            }
        } else throw new Error('Unsupported worker operation.');
        self.postMessage({ id, result });
    } catch {
        key = undefined;
        wrapping = undefined;
        privateDh?.fill(0);
        privateDh = undefined;
        self.postMessage({
            id,
            error: 'The secret action failed. Check your vault password or passkey, and try again.',
        });
    }
};
