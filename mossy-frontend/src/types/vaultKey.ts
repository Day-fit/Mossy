export type VaultKeyMetadata =
    | { type: 'Text' }
    | { type: 'PRF'; credentialId: string; prfSalt: Uint8Array<ArrayBuffer> };
export type StoredVaultKey = VaultKeyMetadata & {
    wrappedKey: ArrayBuffer;
    salt: Uint8Array<ArrayBuffer>;
};
export type StoredUserPasskey = {
    type: 'UserPRF';
    credentialId: string;
};
export type PasskeyReservation = {
    type: 'PendingPRF';
    userHandle: Uint8Array<ArrayBuffer>;
};
export type VaultKeyProtection = {
    userId: string;
    passkey: Uint8Array<ArrayBuffer>;
    metadata: VaultKeyMetadata;
};
