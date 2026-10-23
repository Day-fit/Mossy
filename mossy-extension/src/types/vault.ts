export type Scope = { instance: string; accountId: string; vaultId: string };

export type WrappedKeyRecord = { wrappedKey: ArrayBuffer } & (
    | { type: 'PRF'; credentialId: ArrayBuffer }
    | { type: 'Password'; salt: Uint8Array<ArrayBuffer> }
);
