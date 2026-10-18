export type VaultKeyMetadata =
    | { type: 'Text' }
    | {
          type: 'PRF';
          credentialId: string;
          // The WebAuthn PRF input, distinct from the Argon2 wrapping salt.
          prfSalt: Uint8Array<ArrayBuffer>;
      };

export type StoredVaultKey = VaultKeyMetadata & {
    wrappedKey: ArrayBuffer;
    salt: Uint8Array<ArrayBuffer>;
};

export type StoredUserPasskey = {
    type: 'UserPRF';
    credentialId: string;
};

export type VaultKeyProtection = {
    userId: string;
    passkey: Uint8Array<ArrayBuffer>;
    metadata: VaultKeyMetadata;
};
