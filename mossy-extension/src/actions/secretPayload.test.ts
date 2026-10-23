import { describe, expect, it } from 'vitest';
import { parseSecretPayload } from './secretPayload';

describe('secret payload boundary', () => {
    it.each([undefined, 'ssh-ed25519 AAAA example'])(
        'reads SSH payloads with public key %s',
        (publicKey) => {
            const privateKey =
                '-----BEGIN OPENSSH PRIVATE KEY-----\nfixture\n-----END OPENSSH PRIVATE KEY-----';
            expect(
                parseSecretPayload(
                    JSON.stringify({
                        kind: 'SSH',
                        privateKey,
                        publicKey,
                    })
                )
            ).toEqual({ kind: 'SSH', privateKey, publicKey });
        }
    );

    it('preserves password whitespace', () => {
        expect(
            parseSecretPayload(
                JSON.stringify({
                    kind: 'PASSWORD',
                    password: ' secret ',
                })
            )
        ).toEqual({ kind: 'PASSWORD', password: ' secret ' });
    });

    it.each([
        null,
        [],
        { kind: 'PASSWORD', password: 1 },
        { kind: 'SSH', privateKey: 'key', publicKey: 2 },
    ])('rejects malformed payload %j', (payload) => {
        expect(() => parseSecretPayload(JSON.stringify(payload))).toThrow(
            'Unsupported'
        );
    });
});
