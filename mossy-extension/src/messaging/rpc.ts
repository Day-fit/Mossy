import { defineExtensionMessaging } from '@webext-core/messaging';
import type { ReceiverDetails, UploadVaultKeyRequest } from 'mossy-api-client';
import type { PopupView } from '../ui/popup/types';
import type { Target, DiscoveredForm } from '../security/security';
import type { Theme } from '../theme/types';
import type { Action, ReceivedVaultKey, Vault } from '../types/models';
import type { AccountScope } from '../types/vault';

export type MessageStatus = {
    status: 'ok' | 'error';
};

export type ActionRequest = {
    vaultId: string;
    passwordId: string | undefined;
    target?: Target;
    code?: string;
};

export type FillSuggestion = {
    vaultId: string;
    vaultName: string;
    passwordId: string;
    identifier: string;
};

export type PopupToBackgroundProtocol = {
    getPopupView(data: { vaultId?: string }): PopupView;
    getVaults(): {
        scope: AccountScope;
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

    setTheme(data: { theme: Theme }): MessageStatus;
    handleDismiss(): MessageStatus;
    handleSettings(data: { instance: string; theme: Theme }): MessageStatus;
};

type ContentToBackgroundProtocol = {
    getFillSuggestions(data: { formId: string }): {
        suggestions: FillSuggestion[];
        theme: Theme;
    };
    handleSuggestedFill(data: {
        formId: string;
        vaultId: string;
        passwordId: string;
    }): void;
    handleDiscover(data: { forms: DiscoveredForm[] }): MessageStatus;
    handleCapture(data: {
        password: string;
        identifier: string;
        origin: string;
    }): MessageStatus;
};

export type WrappedKeyPayload = { wrappedKey: number[] } & (
    | { type: 'PRF'; credentialId: number[] }
    | { type: 'Password'; salt: number[] }
);

export type ActionToBackgroundProtocol = {
    claimAction(data: { actionId: string }): Action;
    cancelAction(data: { actionId: string; closeWindow?: boolean }): void;
    getActionCiphertext(data: { actionId: string }): { ciphertext: string };
    getActionCandidate(data: { actionId: string }): string;
    offerKeySync(data: { actionId: string; receiver: ReceiverDetails }): {
        code: string;
    };
    waitForKeySync(data: { actionId: string }): ReceivedVaultKey;
    finishKeySyncReceive(data: {
        actionId: string;
        value: WrappedKeyPayload;
    }): {
        status: 'saved';
    };
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
    rediscoverForms(): MessageStatus;
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
    ContentToBackgroundProtocol &
    ActionToBackgroundProtocol &
    BackgroundToContentProtocol &
    BackgroundToPopupProtocol;

export const messaging = defineExtensionMessaging<ExtensionProtocol>({
    logger: { debug() {}, log() {}, warn() {}, error() {} },
});
