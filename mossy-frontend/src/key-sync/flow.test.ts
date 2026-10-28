import { webcrypto } from 'node:crypto';
import {
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import sodium from 'libsodium-wrappers-sumo';
import type { CryptoPair } from '../auth/deviceIdentity.ts';
import type { PublicIdentityJwk } from 'mossy-api-client/auth.api';
import type {
    PendingReceiver,
    VaultKeyResponse,
} from 'mossy-api-client/keySync.api';
import * as api from 'mossy-api-client/keySync.api';
import { executeGetDeviceIdentityKeyRequest } from 'mossy-api-client/deviceTrust.api';
import { receiveVaultKey } from './receiveVaultKey.ts';
import { getVerifiedReceiver, sendVaultKey } from './sendVaultKey.ts';

vi.mock('mossy-api-client/keySync.api', () => ({
    executeInitKeySyncRequest: vi.fn(),
    executeGetPendingReceiversRequest: vi.fn(),
    executeGetVaultKeysRequest: vi.fn(),
    executeUploadVaultKeyRequest: vi.fn(),
    executeSubscribeReceiverEventsRequest: vi.fn(),
}));
vi.mock('mossy-api-client/deviceTrust.api', () => ({
    executeGetDeviceIdentityKeyRequest: vi.fn(),
}));

async function identity(): Promise<{
    local: CryptoPair;
    publicKey: PublicIdentityJwk;
}> {
    const pair = await crypto.subtle.generateKey('Ed25519', false, [
        'sign',
        'verify',
    ]);
    const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
    if (!jwk.x) throw new Error('Missing public key');
    return {
        local: { type: 'Ed25519', public: jwk.x, privateKey: pair.privateKey },
        publicKey: { kty: 'OKP', crv: 'Ed25519', x: jwk.x },
    };
}

describe('HTTP vault key transfer', () => {
    beforeAll(async () => {
        await sodium.ready;
    });
    beforeEach(async () => {
        vi.resetAllMocks();
        vi.stubGlobal('crypto', webcrypto);
        const handles = await crypto.subtle.generateKey('Ed25519', false, [
            'sign',
            'verify',
        ]);
        vi.stubGlobal('CryptoKey', handles.privateKey.constructor);
    });
    afterEach(() => vi.unstubAllGlobals());

    async function receiverFixture() {
        const cancel = vi.fn();
        let stream!: ReadableStreamDefaultController<Uint8Array>;
        const response = new Response(
            new ReadableStream<Uint8Array>({
                start(controller) {
                    stream = controller;
                },
                cancel,
            })
        );
        vi.mocked(api.executeSubscribeReceiverEventsRequest).mockResolvedValue(
            response
        );
        vi.mocked(api.executeInitKeySyncRequest).mockResolvedValue({
            code: 'ABC123',
        });
        const options = {
            vaultId: 'vault-one',
            receiverId: 'receiver-device',
            identity: (await identity()).local,
            signal: new AbortController().signal,
            onCode: vi.fn(),
            onReceiving: vi.fn(),
            saveKey: vi
                .fn<(key: Uint8Array<ArrayBuffer>) => Promise<void>>()
                .mockResolvedValue(undefined),
        };
        const emit = (result: 'SUCCESS' | 'FAILED', errorMessage?: string) =>
            stream.enqueue(
                new TextEncoder().encode(
                    `data: ${JSON.stringify({ receiverId: options.receiverId, code: 'ABC123', result, errorMessage })}\n\n`
                )
            );
        return { options, cancel, emit };
    }

    it('uploads a signed key over HTTP and saves only the matching transfer from a multi-key response', async () => {
        const fixture = await receiverFixture();
        const receiverIdentity = await identity();
        const senderIdentity = await identity();
        fixture.options.identity = receiverIdentity.local;
        let pending: PendingReceiver | undefined;
        let uploaded: VaultKeyResponse | undefined;
        let codeReadyResolve!: (code: string) => void;
        const codeReady = new Promise<string>((resolve) => {
            codeReadyResolve = resolve;
        });
        fixture.options.onCode.mockImplementation(codeReadyResolve);
        const saved: Uint8Array[] = [];
        fixture.options.saveKey.mockImplementation(async (key) => {
            saved.push(new Uint8Array(key));
        });
        vi.mocked(api.executeInitKeySyncRequest).mockImplementation(
            async (request) => {
                pending = {
                    ...request,
                    receiverId: fixture.options.receiverId,
                    code: 'ABC123',
                };
                return { code: 'ABC123' };
            }
        );
        vi.mocked(api.executeGetPendingReceiversRequest).mockImplementation(
            async () => (pending ? [pending] : [])
        );
        vi.mocked(api.executeGetVaultKeysRequest).mockImplementation(
            async () => ({
                keys: uploaded
                    ? [
                          {
                              ...uploaded,
                              code: 'DEF456',
                              cipherText: 'stale-key',
                          },
                          uploaded,
                      ]
                    : [],
            })
        );
        vi.mocked(executeGetDeviceIdentityKeyRequest).mockImplementation(
            async (deviceId) =>
                deviceId === 'sender-device'
                    ? senderIdentity.publicKey
                    : receiverIdentity.publicKey
        );
        vi.mocked(api.executeUploadVaultKeyRequest).mockImplementation(
            async (code, request) => {
                uploaded = {
                    code,
                    vaultId: request.vaultId,
                    senderId: 'sender-device',
                    cipherText: request.ciphertext,
                    senderPublicDh: request.publicDh.x,
                };
                pending = undefined;
                fixture.emit('SUCCESS');
            }
        );

        const receiving = receiveVaultKey(fixture.options);
        const code = await codeReady;
        const signal = new AbortController().signal;
        const receiver = await getVerifiedReceiver(
            code,
            'sender-device',
            signal
        );
        const rawKey = new Uint8Array(sodium.randombytes_buf(32));
        const key = await crypto.subtle.importKey(
            'raw',
            rawKey,
            { name: 'AES-GCM' },
            true,
            ['encrypt', 'decrypt']
        );
        await sendVaultKey(
            code,
            receiver,
            'sender-device',
            senderIdentity.local,
            key,
            new Uint8Array([1, 2, 3]).buffer,
            signal
        );
        await receiving;

        expect(saved).toEqual([rawKey]);
        expect(fixture.options.saveKey).toHaveBeenCalledWith(
            expect.any(Uint8Array),
            new Uint8Array([1, 2, 3]).buffer
        );
        expect(fixture.cancel).toHaveBeenCalledOnce();
        expect(
            vi.mocked(api.executeSubscribeReceiverEventsRequest).mock
                .invocationCallOrder[0]
        ).toBeLessThan(
            vi.mocked(api.executeInitKeySyncRequest).mock.invocationCallOrder[0]
        );
        expect(executeGetDeviceIdentityKeyRequest).toHaveBeenCalledWith(
            'sender-device',
            fixture.options.signal
        );
    });

    it('closes the subscription if initialization fails without displaying a usable code', async () => {
        const fixture = await receiverFixture();
        vi.mocked(api.executeInitKeySyncRequest).mockRejectedValue(
            new Error('Initialization failed')
        );

        await expect(receiveVaultKey(fixture.options)).rejects.toThrow(
            'Initialization failed'
        );

        expect(fixture.cancel).toHaveBeenCalledOnce();
        expect(fixture.options.onCode).not.toHaveBeenCalled();
        expect(fixture.options.saveKey).not.toHaveBeenCalled();
    });

    it('does not fetch or save a key after a failed upload event', async () => {
        const fixture = await receiverFixture();
        fixture.emit('FAILED', 'Invalid sender connected');

        await expect(receiveVaultKey(fixture.options)).rejects.toThrow(
            'Invalid sender connected'
        );

        expect(api.executeGetVaultKeysRequest).not.toHaveBeenCalled();
        expect(fixture.options.saveKey).not.toHaveBeenCalled();
        expect(fixture.cancel).toHaveBeenCalledOnce();
    });

    it('discards an initialization response that arrives after cancellation', async () => {
        const fixture = await receiverFixture();
        const controller = new AbortController();
        fixture.options.signal = controller.signal;
        vi.mocked(api.executeInitKeySyncRequest).mockImplementation(
            async () => {
                controller.abort();
                return { code: 'ABC123' };
            }
        );

        await expect(receiveVaultKey(fixture.options)).rejects.toThrow();

        expect(fixture.options.onCode).not.toHaveBeenCalled();
        expect(fixture.options.saveKey).not.toHaveBeenCalled();
        expect(fixture.cancel).toHaveBeenCalledOnce();
    });
});
