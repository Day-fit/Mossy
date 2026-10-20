import type { Target } from './security';
import type {
    Scope,
    ReceiverDetails,
    VaultKeyResponse,
    PublicIdentityJwk,
} from '@mossy/client-core';
export type Vault = {
    vaultId: string;
    vaultName: string;
    isOnline?: boolean;
    online?: boolean;
};
export type Entry = {
    passwordId: string;
    identifier: string;
    address: string;
    passwordType: 'PASSWORD' | 'SSH_KEY';
    lastModified: string;
};
export type Operation =
    | 'copy-password'
    | 'copy-username'
    | 'fill'
    | 'save'
    | 'sync-send'
    | 'sync-receive';
export type Action = {
    id: string;
    operation: Operation;
    scope: Scope;
    userId: string;
    vaultName: string;
    deviceId: string;
    entry?: Entry;
    target?: Target;
    candidateId?: string;
    sourceTabId?: number;
    deadline: number;
    candidateDeadline?: number;
    candidateIdentifier?: string;
    candidateOrigin?: string;
    code?: string;
    receiver?: ReceiverDetails;
};
export type ActionResult = {
    status: string;
    code?: string;
    transfer?: VaultKeyResponse;
    senderIdentity?: PublicIdentityJwk;
};
