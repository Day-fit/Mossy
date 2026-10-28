import type { ReceiverDetails, UploadVaultKeyRequest } from 'mossy-api-client';
import type { WrappedKeyRecord } from '../../types/vault';
import {
    createReceiverOffer,
    encryptVaultKey,
    decryptVaultKey,
} from '../keySync';
import type {
    OfferInput,
    SendInput,
    ReceiveInput,
    ProtectInput,
} from './types';
import { exportVaultKey, wrappingKey } from './vault';

let privateDh: Uint8Array | undefined;
let receivedRaw: Uint8Array<ArrayBuffer> | undefined;

export function clearTransferKeys() {
    privateDh?.fill(0);
    privateDh = undefined;
    receivedRaw?.fill(0);
    receivedRaw = undefined;
}

export async function offer(input: OfferInput): Promise<ReceiverDetails> {
    const offer = await createReceiverOffer(
        input.deviceId,
        input.vaultId,
        input
    );
    privateDh = offer.privateDh;
    return offer.receiver;
}

export async function send(input: SendInput): Promise<UploadVaultKeyRequest> {
    const raw = await exportVaultKey();
    try {
        return await encryptVaultKey(
            raw,
            input.credentialId,
            input.context,
            input.deviceId,
            input
        );
    } finally {
        raw.fill(0);
    }
}

export async function receive(
    input: ReceiveInput
): Promise<ArrayBuffer | undefined> {
    if (!privateDh) throw new Error('Sync offer expired.');
    const received = await decryptVaultKey(
        input.transfer,
        input.context,
        privateDh,
        input.senderIdentity
    );
    receivedRaw = received.rawKey;
    privateDh.fill(0);
    privateDh = undefined;
    return received.credentialId;
}

export async function protect(input: ProtectInput): Promise<WrappedKeyRecord> {
    if (!receivedRaw) throw new Error('Receive a vault key first.');
    try {
        const wrapping = await wrappingKey(
            input.protection,
            input.password,
            input.prf
        );
        const received = await crypto.subtle.importKey(
            'raw',
            receivedRaw,
            { name: 'AES-GCM' },
            true,
            ['encrypt', 'decrypt']
        );
        const wrappedKey = await crypto.subtle.wrapKey(
            'raw',
            received,
            wrapping,
            'AES-KW'
        );
        return { ...input.protection, wrappedKey };
    } finally {
        receivedRaw.fill(0);
        receivedRaw = undefined;
    }
}
