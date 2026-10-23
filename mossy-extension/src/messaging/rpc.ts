import { defineExtensionMessaging } from '@webext-core/messaging';
import type { ReceiverDetails, UploadVaultKeyRequest } from 'mossy-api-client';
import type { PopupView } from '../ui/popup/types';
import type { Target } from '../security/security';
import type { DiscoveredForm } from '../background/background';
import type { Theme } from '../theme/types';
import type { Action, ActionResult, Vault } from '../types/models';
import type { Scope } from '../types/vault';

export type MessageStatus = {
    status: 'ok' | 'error';
};

type ActionRequest = {
    vaultId: string;
    passwordId: string | undefined;
    target?: Target;
    code?: string;
};

//TODO: think of better naming, group functions with simmilar domain to separete protocols.
type PopupToBackgroundProtocol = {
    getPopupView(data: { vaultId?: string }): PopupView;
    getVaults(): {
        scope: Pick<Scope, 'instance' | 'accountId'>;
        vaults: Vault[];
    };
    handleCopyPassword(data: ActionRequest): void;
    handleFill(data: ActionRequest): void;
    handleSave(data: ActionRequest): void;
    handleSyncSend(data: ActionRequest): void;
    handleSyncReceive(data: ActionRequest): void;
    handleLogin(data: { identifier: string; password: string }): {
        status: string;
    };
    handleLogout(): MessageStatus;

    setTheme(data: { theme: 'light' | 'dark' | 'system' }): MessageStatus;
    handleDiscover(data: { forms: DiscoveredForm[] }): MessageStatus;
    handleDismiss(): MessageStatus;
    handleCapture(data: {
        password: string;
        identifier: string;
        origin: string;
    }): MessageStatus;
    handleSettings(data: { instance: string; theme: Theme }): MessageStatus;
};

export type WrappedKeyPayload = { wrappedKey: number[] } & (
    | { type: 'PRF'; credentialId: number[] }
    | { type: 'Password'; salt: number[] }
);

type ActionToBackgroundProtocol = {
    claimAction(data: { actionId: string }): Action;
    cancelAction(data: { actionId: string }): void;
    getActionCiphertext(data: { actionId: string }): { ciphertext: string };
    getActionCandidate(data: { actionId: string }): string;
    offerKeySync(data: { actionId: string; receiver: ReceiverDetails }): {
        code: string;
    };
    waitForKeySync(data: { actionId: string }): ActionResult;
    finishKeySyncReceive(data: {
        actionId: string;
        value: WrappedKeyPayload;
    }): ActionResult;
    finishCopyPassword(data: { actionId: string }): { status: 'copied' };
    finishCopyUsername(data: { actionId: string }): { status: 'copied' };
    finishFill(data: { actionId: string; password: string }): {
        status: 'filled';
    };
    finishSave(
        data: { actionId: string } & (
            | { unchanged: true }
            | { ciphertext: string; unchanged?: false }
        )
    ): { status: 'saved' | 'unchanged' };
    finishKeySyncSend(data: {
        actionId: string;
        value: UploadVaultKeyRequest;
    }): {
        status: 'sent';
    };
};

type BackgroundToContentProtocol = {
    fillOnce(data: {
        actionId: string;
        target: Target;
        identifier: string;
        password: string;
    }): { valid: boolean };
};

type BackgroundToPopupProtocol = {
    onChanged(): void;
};

export type ExtensionProtocol = PopupToBackgroundProtocol &
    ActionToBackgroundProtocol &
    BackgroundToContentProtocol &
    BackgroundToPopupProtocol;

export const messaging = defineExtensionMessaging<ExtensionProtocol>();
