export type AccountScope = { instance: string; accountId: string };

export type Scope = AccountScope & { vaultId: string };

export type WrappedKeyRecord = { wrappedKey: ArrayBuffer } & (
    | { type: 'PRF'; credentialId: ArrayBuffer }
    | { type: 'Password'; salt: Uint8Array<ArrayBuffer> }
);
