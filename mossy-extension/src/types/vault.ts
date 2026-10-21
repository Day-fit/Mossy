export type Scope = { instance: string; account: string; vault: string };

export type WrappedKeyRecord = { wrappedKey: ArrayBuffer } & (
    | { type: 'PRF'; credentialId: ArrayBuffer }
    | { type: 'Password'; salt: Uint8Array<ArrayBuffer> }
);
