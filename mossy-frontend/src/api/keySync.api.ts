import { apiFetch } from './client.ts';

export type PublicDhJwk = { kty: 'OKP'; crv: 'X25519'; x: string };

export type ReceiverDetails = {
    receiverId: string;
    vaultId: string;
    publicDh: PublicDhJwk;
    signature: string;
};

export type InitKeySyncRequest = Omit<ReceiverDetails, 'receiverId'>;

export type UploadVaultKeyRequest = {
    vaultId: string;
    ciphertext: string;
    publicDh: PublicDhJwk;
};

export type VaultKeyResponse = {
    code: string;
    vaultId: string;
    senderId: string;
    cipherText: string;
    senderPublicDh: string;
};

export type PendingReceiver = ReceiverDetails & { code: string };
export type VaultKeysResponse = {
    keys: VaultKeyResponse[];
};

export async function executeGetPendingReceiversRequest(
    signal: AbortSignal
): Promise<PendingReceiver[]> {
    return apiFetch('/api/v1/key-sync/receivers', { signal }).then((response) =>
        response.json()
    );
}

export async function executeInitKeySyncRequest(
    request: InitKeySyncRequest,
    signal: AbortSignal
): Promise<{ code: string }> {
    return apiFetch('/api/v1/key-sync', {
        method: 'POST',
        body: JSON.stringify(request),
        signal,
    }).then((response) => response.json());
}

export async function executeUploadVaultKeyRequest(
    code: string,
    request: UploadVaultKeyRequest,
    signal: AbortSignal
): Promise<void> {
    await apiFetch(`/api/v1/key-sync/${encodeURIComponent(code)}`, {
        method: 'POST',
        body: JSON.stringify(request),
        signal,
    });
}

export async function executeGetVaultKeysRequest(
    signal: AbortSignal
): Promise<VaultKeysResponse> {
    return apiFetch('/api/v1/key-sync/vault-keys', { signal }).then(
        (response) => response.json()
    );
}

export function executeSubscribeReceiverEventsRequest(
    signal: AbortSignal
): Promise<Response> {
    return apiFetch('/api/v1/key-sync/receiver-events', {
        headers: { Accept: 'text/event-stream' },
        signal,
    });
}
