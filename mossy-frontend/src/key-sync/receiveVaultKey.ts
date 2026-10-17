import sodium from 'libsodium-wrappers-sumo';
import type { CryptoPair } from '../auth/deviceIdentity.ts';
import { executeGetDeviceIdentityKeyRequest } from '../api/deviceTrust.api.ts';
import {
    executeGetVaultKeysRequest,
    executeInitKeySyncRequest,
    executeSubscribeReceiverEventsRequest,
} from '../api/keySync.api.ts';
import { createReceiverOffer, decryptVaultKey } from './crypto.ts';
import { waitForReceiverResult } from './receiverEvents.ts';

type ReceiveVaultKeyOptions = {
    vaultId: string;
    receiverId: string;
    identity: CryptoPair;
    signal: AbortSignal;
    onCode: (code: string) => void;
    onReceiving: () => void;
    saveKey: (key: Uint8Array<ArrayBuffer>) => Promise<void>;
};

export async function receiveVaultKey(
    options: ReceiveVaultKeyOptions
): Promise<void> {
    const { receiver, privateDh } = await createReceiverOffer(
        options.receiverId,
        options.vaultId,
        options.identity
    );
    let events: Response | undefined;
    try {
        // Establish the subscription before exposing a code that a sender can consume.
        events = await executeSubscribeReceiverEventsRequest(options.signal);
        const { code } = await executeInitKeySyncRequest(
            {
                vaultId: receiver.vaultId,
                publicDh: receiver.publicDh,
                signature: receiver.signature,
            },
            options.signal
        );
        options.signal.throwIfAborted();
        options.onCode(code);
        await waitForReceiverResult(events, options.receiverId);
        options.signal.throwIfAborted();
        options.onReceiving();
        const { keys } = await executeGetVaultKeysRequest(options.signal);
        const key = keys.find(
            (candidate) =>
                candidate.vaultId === options.vaultId && candidate.code === code
        );
        if (!key)
            throw new Error(
                'No encrypted key was found for this vault. Please try again.'
            );
        const senderIdentity = await executeGetDeviceIdentityKeyRequest(
            key.senderId,
            options.signal
        );
        const rawKey = await decryptVaultKey(
            key,
            { code, receiver },
            privateDh,
            senderIdentity
        );
        try {
            options.signal.throwIfAborted();
            await options.saveKey(rawKey);
        } finally {
            sodium.memzero(rawKey);
        }
    } finally {
        sodium.memzero(privateDh);
        await events?.body?.cancel().catch(() => undefined);
    }
}
