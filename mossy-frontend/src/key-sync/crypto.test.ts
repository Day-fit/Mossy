import { beforeAll, describe, expect, it } from 'vitest';
import sodium from 'libsodium-wrappers-sumo';
import type { CryptoPair } from '../auth/deviceIdentity.ts';
import type { PublicIdentityJwk } from '../api/auth.api.ts';
import {
    createReceiverOffer,
    decryptVaultKey,
    encryptVaultKey,
    verifyReceiverDetails,
} from './crypto.ts';

const encode = (bytes: Uint8Array) =>
    sodium.to_base64(bytes, sodium.base64_variants.URLSAFE_NO_PADDING);

function identity(): { privateKey: CryptoPair; publicKey: PublicIdentityJwk } {
    const pair = sodium.crypto_sign_keypair();
    return {
        privateKey: {
            type: 'Ed25519',
            public: encode(pair.publicKey),
            private: encode(pair.privateKey),
        },
        publicKey: { kty: 'OKP', crv: 'Ed25519', x: encode(pair.publicKey) },
    };
}

async function transfer() {
    const sender = identity();
    const receiverIdentity = identity();
    const offer = await createReceiverOffer(
        'receiver-device',
        'vault-one',
        receiverIdentity.privateKey
    );
    const context = { code: 'ABC123', receiver: offer.receiver };
    const rawKey = new Uint8Array(sodium.randombytes_buf(32));
    const upload = await encryptVaultKey(
        rawKey,
        new Uint8Array([1, 2, 3]).buffer,
        context,
        'sender-device',
        sender.privateKey
    );
    const key = {
        code: context.code,
        vaultId: upload.vaultId,
        senderId: 'sender-device',
        cipherText: upload.ciphertext,
        senderPublicDh: upload.publicDh.x,
    };
    return { sender, receiverIdentity, offer, context, rawKey, key };
}

describe('HTTP key transfer cryptography', () => {
    beforeAll(async () => {
        await sodium.ready;
    });

    it('authenticates the receiver offer and recovers the uploaded key on the receiving device', async () => {
        const data = await transfer();
        await expect(
            verifyReceiverDetails(
                data.offer.receiver,
                data.receiverIdentity.publicKey
            )
        ).resolves.toBeUndefined();
        await expect(
            decryptVaultKey(
                data.key,
                data.context,
                data.offer.privateDh,
                data.sender.publicKey
            )
        ).resolves.toEqual({
            rawKey: data.rawKey,
            credentialId: new Uint8Array([1, 2, 3]).buffer,
        });
    });

    it.each(['receiverId', 'vaultId', 'publicDh'] as const)(
        'rejects a receiver offer with a substituted %s',
        async (field) => {
            const { offer, receiverIdentity } = await transfer();
            const receiver = { ...offer.receiver };
            if (field === 'publicDh')
                receiver.publicDh = {
                    ...receiver.publicDh,
                    x: encode(sodium.crypto_box_keypair().publicKey),
                };
            else receiver[field] = 'substituted';

            await expect(
                verifyReceiverDetails(receiver, receiverIdentity.publicKey)
            ).rejects.toThrow('could not be verified');
        }
    );

    it.each([
        'code',
        'receiverId',
        'receiverDh',
        'senderId',
        'senderDh',
        'nonce',
        'ciphertext',
    ] as const)(
        'rejects an uploaded key with a substituted %s',
        async (field) => {
            const { key, context, offer, sender } = await transfer();
            switch (field) {
                case 'code':
                    context.code = 'DEF456';
                    key.code = context.code;
                    break;
                case 'receiverId':
                    context.receiver.receiverId = 'another-receiver';
                    break;
                case 'receiverDh':
                    context.receiver.publicDh = {
                        ...context.receiver.publicDh,
                        x: encode(sodium.crypto_box_keypair().publicKey),
                    };
                    break;
                case 'senderId':
                    key.senderId = 'another-sender';
                    break;
                case 'senderDh':
                    key.senderPublicDh = encode(
                        sodium.crypto_box_keypair().publicKey
                    );
                    break;
                case 'nonce':
                case 'ciphertext': {
                    const envelope = JSON.parse(key.cipherText);
                    envelope[field] = encode(sodium.randombytes_buf(24));
                    key.cipherText = JSON.stringify(envelope);
                }
            }

            await expect(
                decryptVaultKey(key, context, offer.privateDh, sender.publicKey)
            ).rejects.toThrow('signature could not be verified');
        }
    );

    it('rejects a key for another vault before saving it', async () => {
        const { key, context, offer, sender } = await transfer();
        key.vaultId = 'another-vault';
        await expect(
            decryptVaultKey(key, context, offer.privateDh, sender.publicKey)
        ).rejects.toThrow('different vault');
    });

    it('rejects a key whose signature does not belong to the claimed sender identity', async () => {
        const { key, context, offer } = await transfer();
        await expect(
            decryptVaultKey(key, context, offer.privateDh, identity().publicKey)
        ).rejects.toThrow('signature could not be verified');
    });
});
