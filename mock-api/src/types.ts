import type { ValidateFunction } from "ajv";

export type AuthMode = "public" | "optional" | "access" | "enrollment";

export type RouteContract = {
  id: string;
  method: "get" | "post" | "put" | "patch" | "delete";
  path: string;
  auth: AuthMode;
  request: {
    body?: string;
    params?: string;
    query?: string;
    headers?: string;
  };
  responses: Record<string, string | null>;
};

export type OperationOverride = {
  status: number;
  delayMs?: number;
  headers?: Record<string, string>;
  body?: unknown;
};

export type ScenarioSettings = {
  autoApproveEnrollments: boolean;
  newVaultsOnline: boolean;
  overrides: Record<string, OperationOverride>;
};

export type PublicJwk = {
  kty: "OKP";
  crv: "Ed25519";
  x: string;
};

export type UserRecord = {
  id: string;
  username: string;
  email: string | null;
  password: string;
  grantedAuthorities: string[];
};

export type DeviceRecord = {
  id: string;
  userId: string;
  publicIdentityKey: PublicJwk;
  lastOsName: string;
  deviceType: string;
  remoteAddr: string;
  lastSeen: string | null;
  blocked: boolean;
  approved: boolean;
};

export type EnrollmentRecord = {
  id: string;
  userId: string;
  deviceId: string;
  publicIdentityKey: PublicJwk;
  userAgent: string;
  remoteAddr: string;
  createdAt: string;
};

export type VaultRecord = {
  id: string;
  userId: string;
  name: string;
  isOnline: boolean;
  lastSeenAt: string | null;
  apiKey: string;
};

export type PasswordType = "PASSWORD" | "SSH_KEY";

export type PasswordRecord = {
  id: string;
  vaultId: string;
  userId: string;
  identifier: string;
  address: string;
  cipherText: string;
  lastModified: string;
  passwordType: PasswordType;
  tagIds: string[];
  note: string | null;
};

export type TagRecord = {
  id: string;
  vaultId: string;
  userId: string;
  name: string;
  color: string;
};

export type ActionType = "ADDED" | "REMOVED" | "UPDATED";

export type EventRecord = {
  id: string;
  userId: string;
  vaultId: string;
  passwordId: string;
  domain: string;
  actionType: ActionType;
  date: string;
};

export type ScenarioState = {
  users: UserRecord[];
  devices: DeviceRecord[];
  enrollments: EnrollmentRecord[];
  vaults: VaultRecord[];
  passwords: PasswordRecord[];
  tags: TagRecord[];
  events: EventRecord[];
};

export type ContractBundle = {
  routes: RouteContract[];
  validators: Map<string, ValidateFunction>;
  settings: ScenarioSettings;
  state: ScenarioState;
  scenarioName: string;
};

export type TokenType = "ACCESS_TOKEN" | "DEVICE_ENROLLMENT_TOKEN";

export type TokenSession = {
  token: string;
  type: TokenType;
  userId: string;
  deviceId: string | null;
};

export type AuthContext = {
  session: TokenSession | null;
  user: UserRecord | null;
  device: DeviceRecord | null;
};

export type OperationResult = {
  status?: number;
  headers?: Record<string, string>;
  body?: unknown;
};
