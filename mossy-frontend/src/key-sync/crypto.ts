import {
    createReceiverOffer as createOffer,
    encryptVaultKey as encryptKey,
    type TransferContext,
} from 'mossy-api-client/key-sync/crypto';
import {
    signDeviceTranscript,
    type CryptoPair,
} from '../auth/deviceIdentity.ts';

export {
    decryptVaultKey,
    verifyReceiverDetails,
    type TransferContext,
} from 'mossy-api-client/key-sync/crypto';

export async function createReceiverOffer(
    receiverId: string,
    vaultId: string,
    identity: CryptoPair
) {
    return createOffer(receiverId, vaultId, (transcript) =>
        signDeviceTranscript(identity, transcript)
    );
}

export async function encryptVaultKey(
    key: Uint8Array,
    credentialId: ArrayBuffer | undefined,
    context: TransferContext,
    senderId: string,
    identity: CryptoPair
) {
    return encryptKey(key, credentialId, context, senderId, (transcript) =>
        signDeviceTranscript(identity, transcript)
    );
}
