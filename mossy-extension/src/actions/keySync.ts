import {
    createReceiverOffer as createOffer,
    encryptVaultKey as encryptKey,
    type TransferContext,
} from 'mossy-api-client/key-sync/crypto';
import type { NativeIdentity } from '../storage/deviceIdentity';

export {
    decryptVaultKey,
    verifyReceiverDetails,
    type TransferContext,
} from 'mossy-api-client/key-sync/crypto';

export async function createReceiverOffer(
    receiverId: string,
    vaultId: string,
    identity: NativeIdentity
) {
    return createOffer(receiverId, vaultId, (transcript) =>
        sign(identity, transcript)
    );
}

export async function encryptVaultKey(
    key: Uint8Array,
    credentialId: ArrayBuffer | undefined,
    context: TransferContext,
    senderId: string,
    identity: NativeIdentity
) {
    return encryptKey(key, credentialId, context, senderId, (transcript) =>
        sign(identity, transcript)
    );
}

async function sign(
    identity: NativeIdentity,
    transcript: Uint8Array
): Promise<Uint8Array> {
    return new Uint8Array(
        await crypto.subtle.sign(
            'Ed25519',
            identity.privateKey,
            new Uint8Array(transcript)
        )
    );
}
