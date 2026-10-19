export type CryptoPair = { type: 'Ed25519'; public: string; private: string };
export type PublicIdentityJwk = { kty: 'OKP'; crv: 'Ed25519'; x: string };
export type PublicDhJwk = { kty: 'OKP'; crv: 'X25519'; x: string };
export type ReceiverDetails = {
    receiverId: string;
    vaultId: string;
    publicDh: PublicDhJwk;
    signature: string;
};
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
export interface DeviceSigner {
    publicJwk(): Promise<PublicIdentityJwk>;
    sign(transcript: Uint8Array): Promise<Uint8Array>;
}
export interface Transport {
    request<T>(
        path: string,
        options?: RequestInit & { token?: string; anonymous?: boolean }
    ): Promise<T>;
}
export type Scope = { instance: string; account: string; vault: string };
export type WrappedKeyRecord = { wrappedKey: ArrayBuffer } & (
    | { type: 'PRF' }
    | { type: 'Password'; salt: Uint8Array<ArrayBuffer> }
);
export interface WrappedKeyRepository {
    read(scope: Scope): Promise<WrappedKeyRecord | undefined>;
    write(scope: Scope, record: WrappedKeyRecord): Promise<void>;
}
export interface ProtectionProvider {
    getPrf(userId: string): Promise<AuthenticationExtensionsClientOutputs>;
}
export interface AccountScope {
    current(): Scope;
    assert(scope: Scope): void;
}
