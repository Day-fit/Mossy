import sodium from 'libsodium-wrappers-sumo';
import type { CryptoPair } from '../auth/deviceIdentity.ts';
import { executeGetDeviceIdentityKeyRequest } from '../api/deviceTrust.api.ts';
import {
    executeGetPendingReceiversRequest,
    executeUploadVaultKeyRequest,
    type ReceiverDetails,
} from '../api/keySync.api.ts';
import { encryptVaultKey, verifyReceiverDetails } from './crypto.ts';
import { isSyncCode } from './code.ts';

export async function getVerifiedReceiver(
    code: string,
    senderId: string,
    signal: AbortSignal
): Promise<ReceiverDetails> {
    if (!isSyncCode(code))
        throw new Error(
            'Enter the six-character sync code from the receiving device.'
        );
    const pendingReceivers = await executeGetPendingReceiversRequest(signal);
    const receiver = pendingReceivers.find(
        (candidate) => candidate.code === code
    );
    if (!receiver)
        throw new Error(
            'This sync code is no longer available. Generate a new code on the receiving device.'
        );
    if (receiver.receiverId === senderId)
        throw new Error(
            'Open this page on the device that already has the vault key.'
        );
    const identity = await executeGetDeviceIdentityKeyRequest(
        receiver.receiverId,
        signal
    );
    await verifyReceiverDetails(receiver, identity);
    return receiver;
}

export async function sendVaultKey(
    code: string,
    receiver: ReceiverDetails,
    senderId: string,
    identity: CryptoPair,
    key: CryptoKey,
    credentialId: ArrayBuffer | undefined,
    signal: AbortSignal
): Promise<void> {
    const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', key));
    try {
        const request = await encryptVaultKey(
            rawKey,
            credentialId,
            { code, receiver },
            senderId,
            identity
        );
        signal.throwIfAborted();
        await executeUploadVaultKeyRequest(code, request, signal);
    } finally {
        sodium.memzero(rawKey);
    }
}
