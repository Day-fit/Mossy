import type { Entry, Vault, Operation } from '../../types/models';
import type { Target } from '../../security/security';
import type { PendingMetadata } from '../../capture/PendingCapture';

export type PopupView = {
    instance: string;
    theme: 'light' | 'dark' | 'system';
    permission: boolean;
    account: { userId: string; username: string } | null;
    selected?: string;
    vaults: Vault[];
    entries: Entry[];
    pending: PendingMetadata | null;
    targets: Target[];
};

export type RunPopupTask = (work: () => Promise<unknown>) => Promise<void>;
export type RunPopupAction = (
    operation: Operation,
    entry?: Entry,
    target?: Target,
    code?: string
) => Promise<void>;
