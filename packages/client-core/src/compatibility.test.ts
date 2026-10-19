import { describe, expect, it } from 'vitest';
import sodium from 'libsodium-wrappers-sumo';
import {
    createReceiverOffer,
    verifyReceiverDetails,
    encryptVaultKey,
    decryptVaultKey,
} from './keySync';
import {
    encryptWithKey,
    decryptWithKey,
    importWrappingKey,
    passwordWrappingKey,
    prfInput,
    prfBytes,
    unwrapVaultKey,
    scopeKey,
} from './vaultCrypto';
import { parseSecretPayload, serializeSecretPayload } from './secretPayload';
import type {
    DeviceSigner,
    CryptoPair,
    PublicIdentityJwk,
    VaultKeyResponse,
} from './types';
async function sodiumIdentity(): Promise<CryptoPair> {
    await sodium.ready;
    const pair = sodium.crypto_sign_keypair();
    return {
        type: 'Ed25519',
        public: sodium.to_base64(
            pair.publicKey,
            sodium.base64_variants.URLSAFE_NO_PADDING
        ),
        private: sodium.to_base64(
            pair.privateKey,
            sodium.base64_variants.URLSAFE_NO_PADDING
        ),
    };
}
async function nativeIdentity(): Promise<DeviceSigner> {
    const pair = (await crypto.subtle.generateKey('Ed25519', false, [
        'sign',
        'verify',
    ])) as CryptoKeyPair;
    expect(pair.privateKey.extractable).toBe(false);
    await expect(
        crypto.subtle.exportKey('pkcs8', pair.privateKey)
    ).rejects.toThrow();
    const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
    return {
        publicJwk: async () => ({ kty: 'OKP', crv: 'Ed25519', x: jwk.x! }),
        sign: async (data) =>
            new Uint8Array(
                await crypto.subtle.sign(
                    'Ed25519',
                    pair.privateKey,
                    new Uint8Array(data)
                )
            ),
    };
}
const publicIdentity = async (
    identity: CryptoPair | DeviceSigner
): Promise<PublicIdentityJwk> =>
    'publicJwk' in identity
        ? identity.publicJwk()
        : { kty: 'OKP', crv: 'Ed25519', x: identity.public };
describe('frontend / native extension wire compatibility', () => {
    it.each(['web-to-extension', 'extension-to-web'] as const)(
        'transfers signed keys %s and rejects every bound-context tamper',
        async (direction) => {
            const native = await nativeIdentity();
            const web = await sodiumIdentity();
            const receiverIdentity =
                direction === 'web-to-extension' ? native : web;
            const sender = direction === 'web-to-extension' ? web : native;
            const offer = await createReceiverOffer(
                'receiver',
                'vault',
                receiverIdentity
            );
            await verifyReceiverDetails(
                offer.receiver,
                await publicIdentity(receiverIdentity)
            );
            const context = { code: 'ABC123', receiver: offer.receiver };
            const raw = crypto.getRandomValues(new Uint8Array(32));
            const encrypted = await encryptVaultKey(
                raw,
                context,
                'sender',
                sender
            );
            const transfer: VaultKeyResponse = {
                code: context.code,
                vaultId: 'vault',
                senderId: 'sender',
                cipherText: encrypted.ciphertext,
                senderPublicDh: encrypted.publicDh.x,
            };
            expect(
                await decryptVaultKey(
                    transfer,
                    context,
                    offer.privateDh,
                    await publicIdentity(sender)
                )
            ).toEqual(raw);
            for (const changed of [
                { vaultId: 'other' },
                { code: 'ZZZ999' },
                { senderId: 'attacker' },
                { senderPublicDh: offer.receiver.publicDh.x },
                {
                    cipherText: encrypted.ciphertext.replace(
                        '"version":1',
                        '"version":2'
                    ),
                },
            ])
                await expect(
                    decryptVaultKey(
                        { ...transfer, ...changed },
                        context,
                        offer.privateDh,
                        await publicIdentity(sender)
                    )
                ).rejects.toThrow();
            await expect(
                verifyReceiverDetails(
                    { ...offer.receiver, vaultId: 'other' },
                    await publicIdentity(receiverIdentity)
                )
            ).rejects.toThrow();
            offer.privateDh.fill(0);
            raw.fill(0);
        }
    );
    it('preserves PRF salt input, AES-KW and iv+ciphertext AES-GCM format with nonextractable ordinary keys', async () => {
        expect(new TextDecoder().decode(prfInput('user'))).toBe(
            'mossy:encryption:v1:user'
        );
        const bytes = new Uint8Array(32).fill(71);
        const wrapping = await importWrappingKey(
            prfBytes({ prf: { results: { first: bytes.buffer } } })
        );
        const raw = crypto.getRandomValues(new Uint8Array(32));
        const baseline = await crypto.subtle.importKey(
            'raw',
            raw,
            { name: 'AES-GCM' },
            true,
            ['encrypt', 'decrypt']
        );
        const record = {
            type: 'PRF' as const,
            wrappedKey: await crypto.subtle.wrapKey(
                'raw',
                baseline,
                wrapping,
                'AES-KW'
            ),
        };
        const key = await unwrapVaultKey(record, wrapping);
        expect(key.extractable).toBe(false);
        await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();
        const text = serializeSecretPayload({
            passwordType: 'PASSWORD',
            password: 'example\u0000𝄞',
        });
        const encrypted = await encryptWithKey(text, key);
        const blob = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
        expect(
            new TextDecoder().decode(
                await crypto.subtle.decrypt(
                    { name: 'AES-GCM', iv: blob.slice(0, 12) },
                    baseline,
                    blob.slice(12)
                )
            )
        ).toBe(text);
        expect(
            parseSecretPayload(await decryptWithKey(encrypted, baseline))
        ).toEqual({ kind: 'PASSWORD', password: 'example\u0000𝄞' });
        blob[15] ^= 1;
        await expect(
            decryptWithKey(btoa(String.fromCharCode(...blob)), key)
        ).rejects.toThrow();
        await expect(decryptWithKey('AA==', key)).rejects.toThrow();
        expect(() => prfBytes({})).toThrow();
    });
    it('uses exactly the frontend Argon2id moderate password parameters and salt', async () => {
        await sodium.ready;
        const salt = new Uint8Array(16).fill(9);
        const password = 'a long vault password';
        const baseline = sodium.crypto_pwhash(
            32,
            password,
            salt,
            sodium.crypto_pwhash_OPSLIMIT_MODERATE,
            sodium.crypto_pwhash_MEMLIMIT_MODERATE,
            sodium.crypto_pwhash_ALG_ARGON2ID13
        );
        const key = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
        const wrappedKey = await crypto.subtle.wrapKey(
            'raw',
            key,
            await importWrappingKey(new Uint8Array(baseline)),
            'AES-KW'
        );
        baseline.fill(0);
        const unlocked = await unwrapVaultKey(
            { type: 'Password', salt, wrappedKey },
            await passwordWrappingKey(password, salt)
        );
        expect(
            await decryptWithKey(await encryptWithKey('secret', key), unlocked)
        ).toBe('secret');
    }, 60000);
    it('separates instance, account and vault without concatenation collisions', () => {
        const scope = {
            instance: 'https://mossy.example',
            account: 'alice',
            vault: 'vault',
        };
        expect(
            new Set([
                scopeKey(scope),
                scopeKey({ ...scope, account: 'bob' }),
                scopeKey({ ...scope, instance: 'https://other.example' }),
                scopeKey({ ...scope, vault: 'other' }),
            ]).size
        ).toBe(4);
        expect(() =>
            parseSecretPayload('{"kind":"PASSWORD","password":1}')
        ).toThrow();
        expect(() => parseSecretPayload('plaintext')).toThrow();
    });
});
