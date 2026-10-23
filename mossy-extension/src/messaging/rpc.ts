import { defineExtensionMessaging } from '@webext-core/messaging';
import type { ReceiverDetails, UploadVaultKeyRequest } from 'mossy-api-client';
import type { PopupView } from '../ui/popup/types';
import type { Target } from '../security/security';
import type { DiscoveredForm } from '../background/background';
import type { Theme } from '../theme/types';
import type { Action, ActionResult } from '../types/models';

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

export async function rpc<T>(command: unknown): Promise<T> {
    const response = await chrome.runtime.sendMessage(command);

    if (!response?.ok) {
        throw new Error(
            response?.error ?? 'The extension restarted. Try again.'
        );
    }

    return response.data as T;
}

export class ActionPort {
    private port: chrome.runtime.Port;
    private pending = new Map<
        string,
        { resolve: (value: unknown) => void; reject: (error: Error) => void }
    >();

    constructor(id: string, onDisconnect: () => void) {
        this.port = chrome.runtime.connect({ name: `action:${id}` });
        this.port.onMessage.addListener((data) => {
            const call = this.pending.get(data.id);

            if (!call) {
                return;
            }

            this.pending.delete(data.id);

            if (data.error) {
                call.reject(new Error(data.error));

                return;
            }

            call.resolve(data.result);
        });
        this.port.onDisconnect.addListener(() => {
            for (const call of this.pending.values()) {
                call.reject(
                    new Error('This action expired or the extension restarted.')
                );
            }

            this.pending.clear();
            onDisconnect();
        });
    }

    call<T>(kind: string, value?: unknown): Promise<T> {
        const id = crypto.randomUUID();

        return new Promise((resolve, reject) => {
            this.pending.set(id, {
                resolve: resolve as (value: unknown) => void,
                reject,
            });
            this.port.postMessage({
                id,
                kind,
                ...(value !== undefined ? { value } : {}),
            });
        });
    }

    close() {
        this.port.disconnect();
    }
}
