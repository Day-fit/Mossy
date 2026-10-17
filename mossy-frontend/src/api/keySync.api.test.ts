import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStorage } from '../auth/tokenStorage.ts';
import {
    executeInitKeySyncRequest,
    executeSubscribeReceiverEventsRequest,
    executeUploadVaultKeyRequest,
} from './keySync.api.ts';

describe('key sync HTTP contract', () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const signal = new AbortController().signal;
    const publicDh = {
        kty: 'OKP',
        crv: 'X25519',
        x: 'receiver-dh-key',
    } as const;
    beforeEach(() => {
        fetch.mockReset();
        vi.stubGlobal('fetch', fetch);
        tokenStorage.set('access-token');
    });
    afterEach(() => {
        tokenStorage.set(null);
        vi.unstubAllGlobals();
    });

    it('initializes with the signed receiver metadata at the HTTP root', async () => {
        fetch.mockResolvedValue(Response.json({ code: 'ABC123' }));
        const request = {
            vaultId: 'vault-one',
            publicDh,
            signature: 'receiver-signature',
        };

        await expect(
            executeInitKeySyncRequest(request, signal)
        ).resolves.toEqual({ code: 'ABC123' });

        expect(fetch).toHaveBeenCalledWith(
            '/api/v1/key-sync',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify(request),
                signal,
            })
        );
    });

    it('opens receiver SSE with the access token, event media type, and cancellation signal', async () => {
        fetch.mockResolvedValue(new Response());

        await executeSubscribeReceiverEventsRequest(signal);

        expect(fetch).toHaveBeenCalledWith(
            '/api/v1/key-sync/receiver-events',
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer access-token',
                    Accept: 'text/event-stream',
                }),
                signal,
            })
        );
    });

    it('accepts the empty successful upload response without trying to parse JSON', async () => {
        fetch.mockResolvedValue(new Response(null, { status: 200 }));
        const request = {
            vaultId: 'vault-one',
            publicDh,
            ciphertext: 'encrypted-envelope',
        };

        await expect(
            executeUploadVaultKeyRequest('ABC123', request, signal)
        ).resolves.toBeUndefined();

        expect(fetch).toHaveBeenCalledWith(
            '/api/v1/key-sync/ABC123',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify(request),
                signal,
            })
        );
    });
});
