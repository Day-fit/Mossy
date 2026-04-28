export type UserDetailsResponse = {
  userId: string;
  username: string;
  email: string;
  grantedAuthorities: string[];
};

export type UserVaultDto = {
  vaultId: string;
  vaultName: string;
  isOnline: boolean;
  passwordCount: number;
  lastSeenAt: string | null;
};

export type PasswordMetadataDto = {
  passwordId: string;
  identifier: string;
  domain: string;
  lastModified: string;
};

export type CapturedCredential = {
  id: string;
  domain: string;
  identifier: string;
  password: string;
  createdAt: number;
};

export type CryptoPair = {
  type: 'Ed25519' | 'X25519';
  public: string;
  private: string;
};
