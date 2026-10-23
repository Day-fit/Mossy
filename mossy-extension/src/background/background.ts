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
import { assertLive, type Target } from '../security/security';
import type { Action, Operation } from '../types/models';
import type { Theme } from '../theme/types';
import { themeSetting, lastIdentifierSetting } from '../storage/settings';
import { getInstance, setInstance } from './instance';

let theme: Theme = 'system';
const actions = new Map<string, Action>();
const keySyncWaits = new Map<string, AbortController>();
const forms = new Map<string, Target[]>();
const pending = new PendingCapture(() => {
    void messaging.sendMessage('onChanged').catch(() => undefined);
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
    try {
        const response = await executeExtensionRefreshRequest(instance);
        const { accessToken } = await response.json();
        tokenStorage.set(accessToken);
    } catch {
        tokenStorage.set(null);
    }
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

async function requireUserVault(vaultId: string, instance: string) {
    const vaults = await executeUserVaultsRequest(instance);
    if (!vaults.some((vault) => vault.vaultId === vaultId)) {
        throw new Error('This vault is not available to your account.');
    }
}

function getAction(actionId: string, operation?: Operation): Action {
    const action = actions.get(actionId);
    if (!action) throw new Error('This action expired or was canceled.');
    assertLive(action.deadline);
    if (operation && action.operation !== operation) {
        throw new Error('This action does not support that operation.');
    }
    return action;
}

function consumeAction(actionId: string, operation: Operation): Action {
    const action = getAction(actionId, operation);
    actions.delete(actionId);
    return action;
}

messaging.onMessage('claimAction', ({ data }) => getAction(data.actionId));

messaging.onMessage('cancelAction', ({ data }) => {
    const action = actions.get(data.actionId);
    actions.delete(data.actionId);
    keySyncWaits.get(data.actionId)?.abort();
    if (action?.candidateId) pending.clearIf(action.candidateId);
});

messaging.onMessage('getActionCiphertext', ({ data }) => {
    const action = getAction(data.actionId);
    if (!action.entry) throw new Error('Choose a password.');
    return executePasswordCiphertextRequest(
        action.entry.passwordId,
        action.scope.vaultId,
        action.scope.instance
    );
});

messaging.onMessage('getActionCandidate', ({ data }) => {
    const action = getAction(data.actionId, 'save');
    return pending.consume(action.candidateId!, action.scope.accountId);
});

messaging.onMessage('offerKeySync', async ({ data }) => {
    const action = getAction(data.actionId, 'sync-receive');
    if (data.receiver.vaultId !== action.scope.vaultId) {
        throw new Error('The receiver does not match this vault.');
    }
    const { publicDh, signature } = data.receiver;
    const result = await executeInitKeySyncRequest(
        { vaultId: action.scope.vaultId, publicDh, signature },
        undefined,
        action.scope.instance
    );
    action.receiver = data.receiver;
    action.code = result.code;
    return result;
});

messaging.onMessage('waitForKeySync', async ({ data }) => {
    const action = getAction(data.actionId, 'sync-receive');
    if (!action.code || !action.receiver) {
        throw new Error('Create a key-sync offer first.');
    }
    const controller = new AbortController();
    keySyncWaits.get(action.id)?.abort();
    keySyncWaits.set(action.id, controller);
    const timer = setTimeout(
        () => controller.abort(),
        action.deadline - Date.now()
    );
    const { signal } = controller;
    const instance = action.scope.instance;
    const findTransfer = async () => {
        const { keys } = await executeGetVaultKeysRequest(signal, instance);
        return keys.find(
            (key) =>
                key.code === action.code && key.vaultId === action.scope.vaultId
        );
    };
    try {
        const response = await executeSubscribeReceiverEventsRequest(
            signal,
            instance
        );
        let transfer = await findTransfer();
        if (!transfer) {
            await waitForReceiverResult(
                response,
                action.receiver.receiverId,
                action.code
            );
            transfer = await findTransfer();
        }
        getAction(action.id, 'sync-receive');
        if (!transfer) throw new Error('The vault key was not received.');
        const senderIdentity = await executeGetDeviceIdentityKeyRequest(
            transfer.senderId,
            signal,
            instance
        );
        return { status: 'received', transfer, senderIdentity };
    } finally {
        clearTimeout(timer);
        controller.abort();
        if (keySyncWaits.get(action.id) === controller)
            keySyncWaits.delete(action.id);
    }
});

messaging.onMessage('finishCopyPassword', ({ data }) => {
    consumeAction(data.actionId, 'copy-password');
    return { status: 'copied' };
});

messaging.onMessage('finishCopyUsername', ({ data }) => {
    consumeAction(data.actionId, 'copy-username');
    return { status: 'copied' };
});

messaging.onMessage('finishFill', async ({ data }) => {
    const action = consumeAction(data.actionId, 'fill');
    try {
        if (!action.target || !action.entry)
            throw new Error('Choose a login form.');
        const { valid } = await messaging.sendMessage(
            'fillOnce',
            {
                actionId: action.id,
                target: action.target,
                identifier: action.entry.identifier,
                password: data.password,
            },
            { tabId: action.target.tabId, frameId: action.target.frameId }
        );
        if (!valid) throw new Error('The login form changed. Try again.');
        return { status: 'filled' };
    } finally {
        data.password = '';
    }
});

messaging.onMessage('finishSave', async ({ data }) => {
    const action = consumeAction(data.actionId, 'save');
    if (data.unchanged) return { status: 'unchanged' };
    const payload = {
        vaultId: action.scope.vaultId,
        identifier: action.candidateIdentifier!,
        address: action.candidateOrigin!,
        cipherText: data.ciphertext,
    };
    if (action.entry) {
        await executeUpdatePasswordRequest(
            { ...payload, passwordId: action.entry.passwordId },
            action.scope.instance
        );
    } else {
        await executeSavePasswordRequest(
            { ...payload, passwordType: 'PASSWORD' },
            action.scope.instance
        );
    }
    return { status: 'saved' };
});

messaging.onMessage('finishKeySyncSend', async ({ data }) => {
    const action = consumeAction(data.actionId, 'sync-send');
    if (!action.code || data.value.vaultId !== action.scope.vaultId) {
        throw new Error('The key transfer does not match this action.');
    }
    await executeUploadVaultKeyRequest(
        action.code,
        data.value,
        undefined,
        action.scope.instance
    );
    return { status: 'sent' };
});

messaging.onMessage('finishKeySyncReceive', async ({ data }) => {
    const action = consumeAction(data.actionId, 'sync-receive');
    const value = data.value;
    const wrappedKey = new Uint8Array(value.wrappedKey).buffer;
    await wrappedKeys.write(
        action.scope,
        value.type === 'Password'
            ? { type: 'Password', wrappedKey, salt: new Uint8Array(value.salt) }
            : {
                  type: 'PRF',
                  wrappedKey,
                  credentialId: new Uint8Array(value.credentialId).buffer,
              }
    );
    return { status: 'saved' };
});

messaging.onMessage('getPopupView', async ({ data }) => {
    await ready;
    const instance = await getInstance();
    const [tabs, permission] = await Promise.all([
        chrome.tabs.query({ active: true, lastFocusedWindow: true }),
        chrome.permissions.contains({ origins: ['https://*/*'] }),
    ]);
    if (!tokenStorage.get()) {
        return {
            instance,
            theme,
            permission,
            account: null,
            vaults: [],
            entries: [],
            pending: null,
            targets: [],
        };
    }
    const [user, vaults] = await Promise.all([
        executeUserDetailsRequest(instance),
        executeUserVaultsRequest(instance),
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

messaging.onMessage('getVaults', async () => {
    await ready;
    const instance = await getInstance();
    const [user, vaults] = await Promise.all([
        executeUserDetailsRequest(instance),
        executeUserVaultsRequest(instance),
    ]);

    return { scope: { instance, accountId: user.userId }, vaults };
});

messaging.onMessage('handleCopyPassword', async ({ data }) => {
    await ready;
    const instance = await getInstance();
    const [user, deviceId] = await Promise.all([
        executeUserDetailsRequest(instance),
        lastIdentifierSetting
            .getValue()
            .then((identifier) => loadDeviceId(instance, identifier!)),
        requireUserVault(data.vaultId, instance),
    ]);
    const entry = data.passwordId
        ? (await listEntries(data.vaultId, instance)).find(
              (entry) => entry.passwordId === data.passwordId
          )
        : undefined;
    const action: Action = {
        id: crypto.randomUUID(),
        operation: 'copy-password',
        scope: { instance, accountId: user.userId, vaultId: data.vaultId },
        userId: user.userId,
        deviceId: deviceId!,
        entry,
        deadline: Date.now() + 120000,
    };

    actions.set(action.id, action);
    await chrome.windows.create({
        url: chrome.runtime.getURL(`/action.html#${action.id}`),
        type: 'popup',
        width: 560,
        height: 620,
        focused: true,
    });
});

messaging.onMessage('handleFill', async ({ data }) => {
    await ready;
    const instance = await getInstance();
    const [user, deviceId] = await Promise.all([
        executeUserDetailsRequest(instance),
        lastIdentifierSetting
            .getValue()
            .then((identifier) => loadDeviceId(instance, identifier!)),
        requireUserVault(data.vaultId, instance),
    ]);
    const entry = data.passwordId
        ? (await listEntries(data.vaultId, instance)).find(
              (entry) => entry.passwordId === data.passwordId
          )
        : undefined;
    const action: Action = {
        id: crypto.randomUUID(),
        operation: 'fill',
        scope: { instance, accountId: user.userId, vaultId: data.vaultId },
        userId: user.userId,
        deviceId: deviceId!,
        entry,
        target: data.target,
        deadline: Date.now() + 120000,
    };

    actions.set(action.id, action);
    await chrome.windows.create({
        url: chrome.runtime.getURL(`/action.html#${action.id}`),
        type: 'popup',
        width: 560,
        height: 620,
        focused: true,
    });
});

messaging.onMessage('handleSave', async ({ data }) => {
    await ready;
    const instance = await getInstance();
    const [user, deviceId] = await Promise.all([
        executeUserDetailsRequest(instance),
        lastIdentifierSetting
            .getValue()
            .then((identifier) => loadDeviceId(instance, identifier!)),
        requireUserVault(data.vaultId, instance),
    ]);
    const entry = data.passwordId
        ? (await listEntries(data.vaultId, instance)).find(
              (entry) => entry.passwordId === data.passwordId
          )
        : undefined;
    const candidate = pending.metadata()!;
    pending.handoff(candidate.id, user.userId);
    const action: Action = {
        id: crypto.randomUUID(),
        operation: 'save',
        scope: { instance, accountId: user.userId, vaultId: data.vaultId },
        userId: user.userId,
        deviceId: deviceId!,
        entry,
        candidateId: candidate.id,
        sourceTabId: candidate.tabId,
        candidateIdentifier: candidate.identifier,
        candidateOrigin: candidate.origin,
        candidateDeadline: candidate.deadline,
        deadline: candidate.deadline,
    };

    actions.set(action.id, action);
    await chrome.windows.create({
        url: chrome.runtime.getURL(`/action.html#${action.id}`),
        type: 'popup',
        width: 560,
        height: 620,
        focused: true,
    });
});

messaging.onMessage('handleSyncSend', async ({ data }) => {
    await ready;
    const instance = await getInstance();
    const [user, deviceId] = await Promise.all([
        executeUserDetailsRequest(instance),
        lastIdentifierSetting
            .getValue()
            .then((identifier) => loadDeviceId(instance, identifier!)),
        requireUserVault(data.vaultId, instance),
    ]);
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
    const action: Action = {
        id: crypto.randomUUID(),
        operation: 'sync-send',
        scope: { instance, accountId: user.userId, vaultId: data.vaultId },
        userId: user.userId,
        deviceId: deviceId!,
        deadline: Date.now() + 120000,
        code: data.code,
        receiver,
    };

    actions.set(action.id, action);
    await chrome.windows.create({
        url: chrome.runtime.getURL(`/action.html#${action.id}`),
        type: 'popup',
        width: 560,
        height: 620,
        focused: true,
    });
});

messaging.onMessage('handleSyncReceive', async ({ data }) => {
    await ready;
    const instance = await getInstance();
    const [user, deviceId] = await Promise.all([
        executeUserDetailsRequest(instance),
        lastIdentifierSetting
            .getValue()
            .then((identifier) => loadDeviceId(instance, identifier!)),
        requireUserVault(data.vaultId, instance),
    ]);
    const action: Action = {
        id: crypto.randomUUID(),
        operation: 'sync-receive',
        scope: { instance, accountId: user.userId, vaultId: data.vaultId },
        userId: user.userId,
        deviceId: deviceId!,
        deadline: Date.now() + 300000,
    };

    actions.set(action.id, action);
    await chrome.windows.create({
        url: chrome.runtime.getURL(`/action.html#${action.id}`),
        type: 'popup',
        width: 560,
        height: 620,
        focused: true,
    });
});

export type DiscoveredForm = Omit<Target, 'tabId' | 'frameId' | 'documentId'>;

messaging.onMessage('handleDiscover', ({ data, sender }) => {
    const targets = data.forms.map((form) => ({
        ...form,
        tabId: sender.tab!.id!,
        frameId: sender.frameId!,
        documentId: sender.documentId!,
        origin: new URL(sender.url!).origin,
    }));
    forms.set(`${sender.tab!.id}:${sender.frameId}`, targets);

    return { status: 'ok' };
});

messaging.onMessage('handleDismiss', () => {
    pending.clear();
    return { status: 'ok' };
});

messaging.onMessage('setTheme', async ({ data }) => {
    await themeSetting.setValue(data.theme);
    theme = data.theme;
    return { status: 'ok' };
});

messaging.onMessage('handleCapture', async ({ data, sender }) => {
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

    return { status: staged ? 'ok' : 'error' };
});

messaging.onMessage('handleSettings', async ({ data }) => {
    const instance = await getInstance();
    if (data.instance !== instance) {
        await executeExtensionLogoutRequest(instance).catch(() => undefined);
    }
    await Promise.all([
        setInstance(data.instance),
        themeSetting.setValue(data.theme),
    ]);
    theme = data.theme;
    return { status: 'ok' };
});
