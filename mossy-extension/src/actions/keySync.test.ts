import { beforeAll, describe, expect, it } from 'vitest';
import sodium from 'libsodium-wrappers-sumo';
import {
    createReceiverOffer,
    encryptVaultKey,
    decryptVaultKey,
    verifyReceiverDetails,
} from './keySync';
import * as frontend from '../../../mossy-frontend/src/key-sync/crypto';
import type { NativeIdentity } from '../storage/deviceIdentity';
import type { CryptoPair } from 'mossy-frontend/src/auth/deviceIdentity.ts';

const encode = (value: Uint8Array) =>
    sodium.to_base64(value, sodium.base64_variants.URLSAFE_NO_PADDING);

async function identity() {
    const pair = await crypto.subtle.generateKey('Ed25519', false, [
        'sign',
        'verify',
    ]);
    const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
    if (!jwk.x) throw new Error('Missing public key');
    const publicJwk = { kty: 'OKP', crv: 'Ed25519', x: jwk.x } as const;
    return {
        native: {
            privateKey: pair.privateKey,
            publicJwk,
        } satisfies NativeIdentity,
        web: {
            type: 'Ed25519',
            public: jwk.x,
            privateKey: pair.privateKey,
        } satisfies CryptoPair,
        publicJwk,
    };
}

beforeAll(async () => {
    await sodium.ready;
});

describe('shared key-sync wire compatibility', () => {
    for (const direction of [
        'extension to frontend',
        'frontend to extension',
    ] as const) {
        it.each([undefined, new Uint8Array([1, 2, 3]).buffer])(
            `${direction} preserves the key and optional passkey ID: %s`,
            async (credentialId) => {
                const sender = await identity();
                const receiver = await identity();
                const fromExtension = direction === 'extension to frontend';
                const offer = fromExtension
                    ? await frontend.createReceiverOffer(
                          'receiver',
                          'vault',
                          receiver.web
                      )
                    : await createReceiverOffer(
                          'receiver',
                          'vault',
                          receiver.native
                      );
                await (
                    fromExtension
                        ? verifyReceiverDetails
                        : frontend.verifyReceiverDetails
                )(offer.receiver, receiver.publicJwk);
                const context = { code: 'ABC123', receiver: offer.receiver };
                const rawKey = new Uint8Array(32).fill(17);
                const upload = fromExtension
                    ? await encryptVaultKey(
                          rawKey,
                          credentialId,
                          context,
                          'sender',
                          sender.native
                      )
                    : await frontend.encryptVaultKey(
                          rawKey,
                          credentialId,
                          context,
                          'sender',
                          sender.web
                      );
                const transfer = {
                    code: context.code,
                    vaultId: 'vault',
                    senderId: 'sender',
                    senderPublicDh: upload.publicDh.x,
                    cipherText: upload.ciphertext,
                };
                const received = await (
                    fromExtension ? frontend.decryptVaultKey : decryptVaultKey
                )(transfer, context, offer.privateDh, sender.publicJwk);
                expect(received.rawKey).toEqual(rawKey);
                expect(received.credentialId).toEqual(credentialId);
                await expect(
                    crypto.subtle.exportKey('jwk', sender.native.privateKey)
                ).rejects.toThrow();
            }
        );
    }

    it('accepts the established v2 envelope and signature transcripts produced independently of the shared module', async () => {
        const receiverIdentity = sodium.crypto_sign_keypair();
        const receiverDh = sodium.crypto_box_keypair();
        const senderIdentity = sodium.crypto_sign_keypair();
        const senderDh = sodium.crypto_box_keypair();
        const receiver = {
            receiverId: 'receiver',
            vaultId: 'vault',
            publicDh: {
                kty: 'OKP',
                crv: 'X25519',
                x: encode(receiverDh.publicKey),
            } as const,
            signature: '',
        };
        receiver.signature = encode(
            sodium.crypto_sign_detached(
                sodium.from_string(
                    JSON.stringify([
                        'mossy-key-sync-receiver-v1',
                        'receiver',
                        'vault',
                        'OKP',
                        'X25519',
                        receiver.publicDh.x,
                    ])
                ),
                receiverIdentity.privateKey
            )
        );
        await verifyReceiverDetails(receiver, {
            kty: 'OKP',
            crv: 'Ed25519',
            x: encode(receiverIdentity.publicKey),
        });
        const rawKey = new Uint8Array(32).fill(23);
        const nonce = sodium.randombytes_buf(24);
        const secret = sodium.crypto_scalarmult(
            senderDh.privateKey,
            receiverDh.publicKey
        );
        const ciphertext = encode(
            sodium.crypto_secretbox_easy(
                sodium.from_string(
                    JSON.stringify({
                        rawKey: encode(rawKey),
                        credentialId: null,
                    })
                ),
                nonce,
                secret
            )
        );
        const signature = encode(
            sodium.crypto_sign_detached(
                sodium.from_string(
                    JSON.stringify([
                        'mossy-key-sync-transfer-v2',
                        'ABC123',
                        'vault',
                        'receiver',
                        receiver.publicDh.x,
                        'sender',
                        encode(senderDh.publicKey),
                        encode(nonce),
                        ciphertext,
                    ])
                ),
                senderIdentity.privateKey
            )
        );
        const key = {
            code: 'ABC123',
            vaultId: 'vault',
            senderId: 'sender',
            senderPublicDh: encode(senderDh.publicKey),
            cipherText: JSON.stringify({
                version: 2,
                nonce: encode(nonce),
                ciphertext,
                signature,
            }),
        };
        const senderPublic = {
            kty: 'OKP',
            crv: 'Ed25519',
            x: encode(senderIdentity.publicKey),
        } as const;
        expect(
            await decryptVaultKey(
                key,
                { code: 'ABC123', receiver },
                receiverDh.privateKey,
                senderPublic
            )
        ).toEqual({ rawKey, credentialId: undefined });
        await expect(
            decryptVaultKey(
                {
                    ...key,
                    cipherText: JSON.stringify({
                        ...JSON.parse(key.cipherText),
                        version: 1,
                    }),
                },
                { code: 'ABC123', receiver },
                receiverDh.privateKey,
                senderPublic
            )
        ).rejects.toThrow('invalid encrypted key');
    });
});
