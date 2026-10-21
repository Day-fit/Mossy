import { executeUserDetailsRequest } from 'mossy-api-client/auth.api';
import { executeUserVaultsRequest } from 'mossy-api-client/vault.api';
import { executeGetDeviceIdentityKeyRequest } from 'mossy-api-client/deviceTrust.api';
import {
    executePasswordMetadataRequest,
    executePasswordCiphertextRequest,
    executeSavePasswordRequest,
    executeUpdatePasswordRequest,
} from 'mossy-api-client/password.api';
import {
    executeGetPendingReceiversRequest,
    executeInitKeySyncRequest,
    executeGetVaultKeysRequest,
    executeSubscribeReceiverEventsRequest,
    executeUploadVaultKeyRequest,
} from 'mossy-api-client/keySync.api';
import type { ReceiverDetails, UploadVaultKeyRequest } from 'mossy-api-client';
import { tokenStorage } from 'mossy-api-client/tokenStorage';
import {
    executeExtensionRefreshRequest,
    executeExtensionLogoutRequest,
} from 'mossy-api-client/extension/auth.api';
import { messaging } from '../messaging/rpc';
import { verifyReceiverDetails } from '../actions/keySync';
import { waitForReceiverResult } from '../actions/receiverEvents';
import { wrappedKeys } from '../storage/wrappedKeys';
import { loadDeviceId } from '../storage/deviceIdentity';
import { PendingCapture } from '../capture/PendingCapture';
import type { Target } from '../security/security';
import type { Action } from '../types/models';
import type { Theme } from '../theme/types';
import { themeSetting, lastIdentifierSetting } from '../storage/settings';
import { getInstance, setInstance } from './instance';

let theme: Theme = 'system';
const actions = new Map<string, Action>();
const forms = new Map<string, Target[]>();
const pending = new PendingCapture(() => {
    void chrome.runtime.sendMessage({ kind: 'changed' }).catch(() => undefined);
    const shouldClearBadge = !pending.metadata();
    if (shouldClearBadge) {
        void chrome.action.setBadgeText({ text: '' });
    }
});

const ready = (async () => {
    await chrome.storage.local.setAccessLevel({
        accessLevel: 'TRUSTED_CONTEXTS',
    });
    await chrome.storage.session.setAccessLevel({
        accessLevel: 'TRUSTED_CONTEXTS',
    });
    const [instance, storedTheme] = await Promise.all([
        getInstance(),
        themeSetting.getValue(),
    ]);
    theme = storedTheme;
    const response = await executeExtensionRefreshRequest(instance);
    const { accessToken } = await response.json();
    tokenStorage.set(accessToken);
    await configureCapture();
})();

async function configureCapture() {
    await chrome.scripting
        .unregisterContentScripts({ ids: ['mossy-capture'] })
        .catch(() => undefined);
    const hasWebsiteAccess = await chrome.permissions.contains({
        origins: ['https://*/*'],
    });
    if (hasWebsiteAccess) {
        await chrome.scripting.registerContentScripts([
            {
                id: 'mossy-capture',
                matches: ['https://*/*'],
                js: ['content-scripts/capture.js'],
                allFrames: true,
                runAt: 'document_idle',
                persistAcrossSessions: true,
            },
        ]);
    }
}

chrome.permissions.onAdded.addListener(() => void ready.then(configureCapture));
chrome.permissions.onRemoved.addListener(() => {
    forms.clear();
    pending.clear();
    void ready.then(configureCapture);
});
chrome.tabs.onRemoved.addListener((tabId) => {
    const isCaptureFromRemovedTab = pending.metadata()?.tabId === tabId;
    if (isCaptureFromRemovedTab) pending.clear();
    for (const [key, targets] of forms) {
        if (targets[0]?.tabId === tabId) forms.delete(key);
    }
});
chrome.webNavigation.onCommitted.addListener(({ tabId, frameId }) => {
    forms.delete(`${tabId}:${frameId}`);
});

async function listEntries(vaultId: string, instance: string) {
    return (await executePasswordMetadataRequest(vaultId, instance)).filter(
        (entry) => entry.passwordType === 'PASSWORD'
    );
}

messaging.onMessage('getPopupView', async ({ data }) => {
    await ready;
    const instance = await getInstance();
    const [user, vaults, tabs, permission] = await Promise.all([
        executeUserDetailsRequest(instance),
        executeUserVaultsRequest(instance),
        chrome.tabs.query({ active: true, lastFocusedWindow: true }),
        chrome.permissions.contains({ origins: ['https://*/*'] }),
    ]);
    const selected = data.vaultId ?? vaults[0]?.vaultId;
    return {
        instance,
        theme,
        permission,
        account: { userId: user.userId, username: user.username },
        selected,
        vaults,
        entries: selected ? await listEntries(selected, instance) : [],
        pending: pending.metadata() ?? null,
        targets: [...forms.values()]
            .flat()
            .filter((target) => target.tabId === tabs[0]?.id),
    };
});

messaging.onMessage('handleAction', async ({ data }) => {
    await ready;
    const instance = await getInstance();
    const [user, vaults, deviceId] = await Promise.all([
        executeUserDetailsRequest(instance),
        executeUserVaultsRequest(instance),
        lastIdentifierSetting
            .getValue()
            .then((identifier) => loadDeviceId(instance, identifier!)),
    ]);
    const vault = vaults.find((vault) => vault.vaultId === data.vaultId)!;
    const entry = data.passwordId
        ? (await listEntries(data.vaultId, instance)).find(
              (entry) => entry.passwordId === data.passwordId
          )
        : undefined;
    const action: Action = {
        id: crypto.randomUUID(),
        operation: data.operation,
        scope: { instance, account: user.userId, vault: data.vaultId },
        userId: user.userId,
        vaultName: vault.vaultName,
        deviceId: deviceId!,
        entry,
        target: data.target,
        deadline:
            Date.now() + (data.operation === 'sync-receive' ? 300000 : 120000),
        code: data.code,
    };

    if (data.operation === 'save') {
        const candidate = pending.metadata()!;
        pending.handoff(candidate.id, user.userId);
        Object.assign(action, {
            candidateId: candidate.id,
            sourceTabId: candidate.tabId,
            candidateIdentifier: candidate.identifier,
            candidateOrigin: candidate.origin,
            candidateDeadline: candidate.deadline,
            deadline: candidate.deadline,
        });
    }
    if (data.operation === 'sync-send') {
        const receivers = await executeGetPendingReceiversRequest(
            undefined,
            instance
        );
        const receiver = receivers.find(
            (receiver) =>
                receiver.code === data.code && receiver.vaultId === data.vaultId
        )!;
        await verifyReceiverDetails(
            receiver,
            await executeGetDeviceIdentityKeyRequest(
                receiver.receiverId,
                undefined,
                instance
            )
        );
        action.receiver = receiver;
    }

    actions.set(action.id, action);
    await chrome.windows.create({
        url: chrome.runtime.getURL(`/action.html#${action.id}`),
        type: 'popup',
        width: 560,
        height: 620,
        focused: true,
    });
});

type DiscoveredForm = Omit<Target, 'tabId' | 'frameId' | 'documentId'>;
const messageHandlers = {
    async discover(
        data: { forms: DiscoveredForm[] },
        sender: chrome.runtime.MessageSender
    ) {
        const targets = data.forms.map((form) => ({
            ...form,
            tabId: sender.tab!.id!,
            frameId: sender.frameId!,
            documentId: sender.documentId!,
            origin: new URL(sender.url!).origin,
        }));
        forms.set(`${sender.tab!.id}:${sender.frameId}`, targets);
        return { ok: true };
    },
    async capture(
        data: { password: string; identifier: string; origin: string },
        sender: chrome.runtime.MessageSender
    ) {
        const receivedAt = Date.now();
        const instance = await getInstance();
        const { userId } = await executeUserDetailsRequest(instance);
        const staged = await pending.stage(
            data.password,
            {
                origin: new URL(sender.url!).origin,
                identifier: data.identifier,
                tabId: sender.tab!.id!,
                account: userId,
            },
            receivedAt
        );
        data.password = '';
        if (staged) {
            await chrome.action.openPopup().catch(async () => {
                await chrome.action.setBadgeBackgroundColor({
                    color: '#007735',
                });
                await chrome.action.setBadgeText({ text: 'Save' });
            });
        }
        return { ok: !!staged };
    },
    async theme(data: { theme: Theme }) {
        await themeSetting.setValue(data.theme);
        theme = data.theme;
        return { ok: true };
    },
    async dismiss() {
        pending.clear();
        return { ok: true };
    },
    async settings(data: { instance: string; theme: Theme }) {
        const instance = await getInstance();
        if (data.instance !== instance) {
            await executeExtensionLogoutRequest(instance).catch(
                () => undefined
            );
        }
        await Promise.all([
            setInstance(data.instance),
            themeSetting.setValue(data.theme),
        ]);
        theme = data.theme;
        return { ok: true };
    },
};

chrome.runtime.onMessage.addListener((data, sender, respond) => {
    const handler = messageHandlers[data?.kind as keyof typeof messageHandlers];
    if (!handler) return;
    const work =
        data.kind === 'capture'
            ? handler(data, sender)
            : ready.then(() => handler(data, sender));
    void work.then(
        (data) => respond({ ok: true, data }),
        (error) =>
            respond({
                ok: false,
                error:
                    error instanceof Error ? error.message : 'Request failed.',
            })
    );
    return true;
});

type WrappedKeyPayload = { wrappedKey: number[] } & (
    | { type: 'PRF'; credentialId: number[] }
    | { type: 'Password'; salt: number[] }
);

chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'popup') {
        port.onDisconnect.addListener(() => {
            const shouldDiscardCapture = !pending.metadata()?.handedOff;
            if (shouldDiscardCapture) pending.clear();
        });
        return;
    }
    const isUnrelatedPort = !port.name.startsWith('action:');
    if (isUnrelatedPort) return;
    const id = port.name.slice(7);
    const action = actions.get(id)!;
    const { instance } = action.scope;
    let events: Response;
    port.onDisconnect.addListener(() => actions.delete(id));

    const handlers = {
        async claim() {
            return action;
        },
        async ciphertext() {
            return executePasswordCiphertextRequest(
                action.entry!.passwordId,
                action.scope.vault,
                instance
            );
        },
        async candidate() {
            return pending.consume(action.candidateId!, action.scope.account);
        },
        async offer(receiver: ReceiverDetails) {
            events = await executeSubscribeReceiverEventsRequest(
                undefined,
                instance
            );
            const response = await executeInitKeySyncRequest(
                {
                    vaultId: receiver.vaultId,
                    publicDh: receiver.publicDh,
                    signature: receiver.signature,
                },
                undefined,
                instance
            );
            action.receiver = receiver;
            action.code = response.code;
            return response;
        },
        async wait() {
            await waitForReceiverResult(events, action.deviceId, action.code!);
            const keys = await executeGetVaultKeysRequest(undefined, instance);
            const transfer = keys.keys.find(
                (key) =>
                    key.code === action.code &&
                    key.vaultId === action.scope.vault
            )!;
            return {
                transfer,
                senderIdentity: await executeGetDeviceIdentityKeyRequest(
                    transfer.senderId,
                    undefined,
                    instance
                ),
            };
        },
        async 'receive-finish'(value: WrappedKeyPayload) {
            const wrappedKey = new Uint8Array(value.wrappedKey).buffer;
            const record =
                value.type === 'PRF'
                    ? {
                          type: 'PRF' as const,
                          credentialId: new Uint8Array(value.credentialId)
                              .buffer,
                          wrappedKey,
                      }
                    : {
                          type: 'Password' as const,
                          salt: new Uint8Array(value.salt),
                          wrappedKey,
                      };
            await wrappedKeys.write(action.scope, record);
            return { status: 'saved' };
        },
        async finish(value: unknown) {
            switch (action.operation) {
                case 'fill': {
                    const data = value as { password: string };
                    await chrome.tabs.sendMessage(
                        action.target!.tabId,
                        {
                            kind: 'fill-once',
                            actionId: action.id,
                            target: action.target,
                            identifier: action.entry!.identifier,
                            password: data.password,
                        },
                        { documentId: action.target!.documentId }
                    );
                    data.password = '';
                    return { status: 'filled' };
                }
                case 'save': {
                    const data = value as {
                        ciphertext: string;
                        unchanged?: boolean;
                    };
                    if (data.unchanged) return { status: 'unchanged' };
                    const payload = {
                        vaultId: action.scope.vault,
                        identifier: action.candidateIdentifier!,
                        address: action.candidateOrigin!,
                        cipherText: data.ciphertext,
                    };
                    await (action.entry
                        ? executeUpdatePasswordRequest(
                              {
                                  ...payload,
                                  passwordId: action.entry.passwordId,
                              },
                              instance
                          )
                        : executeSavePasswordRequest(
                              { ...payload, passwordType: 'PASSWORD' },
                              instance
                          ));
                    return { status: 'saved' };
                }
                case 'sync-send':
                    await executeUploadVaultKeyRequest(
                        action.code!,
                        value as UploadVaultKeyRequest,
                        undefined,
                        instance
                    );
                    return { status: 'sent' };
                default:
                    return { status: 'copied' };
            }
        },
    };
    port.onMessage.addListener(({ id, kind, value }) => {
        void handlers[kind as keyof typeof handlers](value).then(
            (result) => port.postMessage({ id, result }),
            (error) =>
                port.postMessage({
                    id,
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Action failed.',
                })
        );
    });
});
