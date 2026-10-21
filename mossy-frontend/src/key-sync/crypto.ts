import sodium from 'libsodium-wrappers-sumo';
import { z } from 'zod';
import type { CryptoPair } from '../auth/deviceIdentity.ts';
import type { PublicIdentityJwk } from 'mossy-api-client/auth.api';
import type {
    ReceiverDetails,
    UploadVaultKeyRequest,
    VaultKeyResponse,
} from 'mossy-api-client/keySync.api';

export type TransferContext = { code: string; receiver: ReceiverDetails };

const envelopeSchema = z
    .object({
        version: z.literal(2),
        nonce: z.string(),
        ciphertext: z.string(),
        signature: z.string(),
    })
    .strict();
type Envelope = z.infer<typeof envelopeSchema>;
const transferredKeySchema = z
    .object({
        rawKey: z.string(),
        credentialId: z.string().nullable(),
    })
    .strict();

const encode = (bytes: Uint8Array) =>
    sodium.to_base64(bytes, sodium.base64_variants.URLSAFE_NO_PADDING);
const decode = (value: string) =>
    sodium.from_base64(value, sodium.base64_variants.URLSAFE_NO_PADDING);

function decodeTransferredKey(plaintext: Uint8Array) {
    const payload = transferredKeySchema.parse(
        JSON.parse(sodium.to_string(plaintext))
    );
    const rawKey = decode(payload.rawKey);
    let credentialId: Uint8Array | undefined;
    try {
        if (rawKey.length !== 32)
            throw new Error('Received an invalid vault key.');
        if (payload.credentialId !== null) {
            credentialId = decode(payload.credentialId);
            if (credentialId.length === 0)
                throw new Error('Received an invalid passkey ID.');
        }
        return {
            rawKey: new Uint8Array(rawKey),
            credentialId: credentialId
                ? new Uint8Array(credentialId).buffer
                : undefined,
        };
    } finally {
        sodium.memzero(rawKey);
        if (credentialId) sodium.memzero(credentialId);
    }
}

function receiverTranscript(
    receiver: Omit<ReceiverDetails, 'signature'>
): Uint8Array {
    return new Uint8Array(
        sodium.from_string(
            JSON.stringify([
                'mossy-key-sync-receiver-v1',
                receiver.receiverId,
                receiver.vaultId,
                receiver.publicDh.kty,
                receiver.publicDh.crv,
                receiver.publicDh.x,
            ])
        )
    );
}

function transferTranscript(
    context: TransferContext,
    senderId: string,
    senderPublicDh: string,
    envelope: Pick<Envelope, 'nonce' | 'ciphertext'>
): Uint8Array {
    return new Uint8Array(
        sodium.from_string(
            JSON.stringify([
                'mossy-key-sync-transfer-v2',
                context.code,
                context.receiver.vaultId,
                context.receiver.receiverId,
                context.receiver.publicDh.x,
                senderId,
                senderPublicDh,
                envelope.nonce,
                envelope.ciphertext,
            ])
        )
    );
}

function validSignature(
    signature: string,
    transcript: Uint8Array,
    identity: PublicIdentityJwk
): boolean {
    try {
        return (
            identity.kty === 'OKP' &&
            identity.crv === 'Ed25519' &&
            sodium.crypto_sign_verify_detached(
                decode(signature),
                transcript,
                decode(identity.x)
            )
        );
    } catch {
        return false;
    }
}

export async function createReceiverOffer(
    receiverId: string,
    vaultId: string,
    identity: CryptoPair
) {
    await sodium.ready;
    if (identity.type !== 'Ed25519')
        throw new Error('The device identity is invalid.');
    const keys = sodium.crypto_box_keypair();
    const receiver = {
        receiverId,
        vaultId,
        publicDh: {
            kty: 'OKP',
            crv: 'X25519',
            x: encode(keys.publicKey),
        } as const,
    };
    return {
        receiver: {
            ...receiver,
            signature: encode(
                sodium.crypto_sign_detached(
                    receiverTranscript(receiver),
                    decode(identity.private)
                )
            ),
        },
        privateDh: new Uint8Array(keys.privateKey),
    };
}

export async function verifyReceiverDetails(
    receiver: ReceiverDetails,
    identity: PublicIdentityJwk
): Promise<void> {
    await sodium.ready;
    if (
        receiver.publicDh.kty !== 'OKP' ||
        receiver.publicDh.crv !== 'X25519' ||
        !validSignature(
            receiver.signature,
            receiverTranscript(receiver),
            identity
        )
    ) {
        throw new Error(
            'The receiving device public key could not be verified.'
        );
    }
}

export async function encryptVaultKey(
    key: Uint8Array,
    credentialId: ArrayBuffer | undefined,
    context: TransferContext,
    senderId: string,
    identity: CryptoPair
): Promise<UploadVaultKeyRequest> {
    await sodium.ready;
    if (identity.type !== 'Ed25519')
        throw new Error('The device identity is invalid.');
    const senderKeys = sodium.crypto_box_keypair();
    const sharedSecret = sodium.crypto_scalarmult(
        senderKeys.privateKey,
        decode(context.receiver.publicDh.x)
    );
    try {
        const nonce = sodium.randombytes_buf(
            sodium.crypto_secretbox_NONCEBYTES
        );
        const payload = new Uint8Array(
            sodium.from_string(
                JSON.stringify({
                    rawKey: encode(key),
                    credentialId: credentialId
                        ? encode(new Uint8Array(credentialId))
                        : null,
                })
            )
        );
        let ciphertext: string;
        try {
            ciphertext = encode(
                sodium.crypto_secretbox_easy(payload, nonce, sharedSecret)
            );
        } finally {
            sodium.memzero(payload);
        }
        const envelope = {
            version: 2 as const,
            nonce: encode(nonce),
            ciphertext,
        };
        const publicDh = encode(senderKeys.publicKey);
        const signature = sodium.crypto_sign_detached(
            transferTranscript(context, senderId, publicDh, envelope),
            decode(identity.private)
        );
        return {
            vaultId: context.receiver.vaultId,
            ciphertext: JSON.stringify({
                ...envelope,
                signature: encode(signature),
            }),
            publicDh: { kty: 'OKP', crv: 'X25519', x: publicDh },
        };
    } finally {
        sodium.memzero(senderKeys.privateKey);
        sodium.memzero(sharedSecret);
    }
}

export async function decryptVaultKey(
    key: VaultKeyResponse,
    context: TransferContext,
    privateDh: Uint8Array,
    senderIdentity: PublicIdentityJwk
): Promise<{ rawKey: Uint8Array<ArrayBuffer>; credentialId?: ArrayBuffer }> {
    await sodium.ready;
    if (key.vaultId !== context.receiver.vaultId)
        throw new Error('Received a key for a different vault.');
    if (key.code !== context.code)
        throw new Error('Received a key for a different sync code.');
    let envelope: Envelope;
    try {
        envelope = envelopeSchema.parse(JSON.parse(key.cipherText));
    } catch {
        throw new Error('Received an invalid encrypted key.');
    }
    if (
        !validSignature(
            envelope.signature,
            transferTranscript(
                context,
                key.senderId,
                key.senderPublicDh,
                envelope
            ),
            senderIdentity
        )
    ) {
        throw new Error('The sending device signature could not be verified.');
    }
    const sharedSecret = sodium.crypto_scalarmult(
        privateDh,
        decode(key.senderPublicDh)
    );
    try {
        const plaintext = sodium.crypto_secretbox_open_easy(
            decode(envelope.ciphertext),
            decode(envelope.nonce),
            sharedSecret
        );
        try {
            return decodeTransferredKey(plaintext);
        } finally {
            sodium.memzero(plaintext);
        }
    } finally {
        sodium.memzero(sharedSecret);
    }
}
