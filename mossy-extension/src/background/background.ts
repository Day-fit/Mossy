import { executeUserDetailsRequest } from 'mossy-api-client/auth.api';
import { ApiError, setAuthRefreshHandler } from 'mossy-api-client/client';
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
import {
    messaging,
    type ActionToBackgroundProtocol,
    type ActionRequest,
} from '../messaging/rpc';
import {
    onPageMessage,
    onPopupMessage,
    type MessageHandler,
} from '../messaging/background';
import { ActionRegistry } from './ActionRegistry';
import { registerAuthHandlers } from './auth.background';
import { verifyReceiverDetails } from '../actions/keySync';
import { waitForReceiverResult } from '../actions/receiverEvents';
import { wrappedKeys } from '../storage/wrappedKeys';
import { loadDeviceId } from '../storage/deviceIdentity';
import { PendingCapture } from '../capture/PendingCapture';
import {
    captureSchema,
    discoverSchema,
    contentSource,
    matchesSite,
    targetSchema,
    validateInstance,
    type Target,
} from '../security/security';
import type { Theme } from '../theme/types';
import type { Entry } from '../types/models';
import {
    themeSetting,
    lastIdentifierSetting,
    selectedVaultsSetting,
} from '../storage/settings';
import { getInstance, setInstance } from './instance';

let theme: Theme = 'system';
const actions = new ActionRegistry((action) => {
    keySyncWaits.get(action.id)?.abort();
    keySyncWaits.delete(action.id);
    if (action.candidateId) pending.clearIf(action.candidateId);
});
function resetSession() {
    tokenStorage.set(null);
    actions.clear();
    pending.clear();
}
const keySyncWaits = new Map<string, AbortController>();
const forms = new Map<string, Target[]>();
const pending = new PendingCapture(() => {
    void messaging.sendMessage('onChanged').catch(() => undefined);
    const shouldClearBadge = !pending.metadata();
    if (shouldClearBadge) {
        void chrome.action.setBadgeText({ text: '' });
    }
});

async function refreshAccessToken(instance: string) {
    try {
        const response = await executeExtensionRefreshRequest(instance);
        const { accessToken } = await response.json();
        if (typeof accessToken !== 'string' || !accessToken) {
            throw new Error('Could not refresh sign-in.');
        }
        tokenStorage.set(accessToken);
    } catch (error) {
        tokenStorage.set(null);
        throw error;
    }
}

setAuthRefreshHandler(() => getInstance().then(refreshAccessToken));

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
    await refreshAccessToken(instance).catch(() => undefined);
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
    actions.cancelWebsiteActions();
    forms.clear();
    pending.clear();
    void ready.then(configureCapture);
});
chrome.tabs.onRemoved.addListener((tabId) => {
    actions.cancelSource(tabId);
    const isCaptureFromRemovedTab = pending.metadata()?.tabId === tabId;
    if (isCaptureFromRemovedTab) pending.clear();
    for (const [key, targets] of forms) {
        if (targets[0]?.tabId === tabId) forms.delete(key);
    }
});
chrome.webNavigation.onCommitted.addListener(({ tabId, frameId }) => {
    actions.cancelFrame(tabId, frameId);
    if (frameId === 0) {
        for (const key of forms.keys()) {
            if (key.startsWith(`${tabId}:`)) forms.delete(key);
        }
    } else {
        forms.delete(`${tabId}:${frameId}`);
    }
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

function onActionMessage<K extends keyof ActionToBackgroundProtocol>(
    name: K,
    handler: MessageHandler<K>
) {
    return onPageMessage(name, ['/action.html'], (message) => {
        actions.authorize(
            message.data.actionId,
            message.sender,
            name === 'claimAction'
        );
        return handler(message);
    });
}

onActionMessage('claimAction', ({ data }) => actions.get(data.actionId));
onActionMessage('cancelAction', ({ data }) =>
    actions.delete(data.actionId, data.closeWindow)
);

onActionMessage('getActionCiphertext', ({ data }) => {
    const action = actions.get(data.actionId);
    if (!action.entry) throw new Error('Choose a password.');
    return executePasswordCiphertextRequest(
        action.entry.passwordId,
        action.scope.vaultId,
        action.scope.instance
    );
});

onActionMessage('getActionCandidate', ({ data }) => {
    const action = actions.get(data.actionId, 'save');
    return pending.consume(action.candidateId!, action.scope.accountId);
});

onActionMessage('offerKeySync', async ({ data }) => {
    const action = actions.get(data.actionId, 'sync-receive');
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

onActionMessage('waitForKeySync', async ({ data }) => {
    const action = actions.get(data.actionId, 'sync-receive');
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
        actions.get(action.id, 'sync-receive');
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

onActionMessage('finishCopyPassword', ({ data }) => {
    actions.consume(data.actionId, 'copy-password');
    return { status: 'copied' };
});

onActionMessage('finishCopyUsername', ({ data }) => {
    actions.consume(data.actionId, 'copy-username');
    return { status: 'copied' };
});

onActionMessage('finishFill', async ({ data }) => {
    const action = actions.consume(data.actionId, 'fill');
    try {
        if (!action.target || !action.entry)
            throw new Error('Choose a login form.');
        requireKnownTarget(action.target);
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

onActionMessage('finishSave', async ({ data }) => {
    const action = actions.consume(data.actionId, 'save');
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

onActionMessage('finishKeySyncSend', async ({ data }) => {
    const action = actions.consume(data.actionId, 'sync-send');
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

onActionMessage('finishKeySyncReceive', async ({ data }) => {
    const action = actions.consume(data.actionId, 'sync-receive');
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

async function refreshForms(
    tab: chrome.tabs.Tab | undefined,
    instance: string
) {
    if (tab?.id === undefined || !tab.url) return;
    const origin = new URL(tab.url).origin;
    if (!tab.url.startsWith('https:') || origin === instance) return;
    const tabId = tab.id;
    const frames = await chrome.webNavigation
        .getAllFrames({ tabId })
        .catch(() => null);
    for (const key of forms.keys()) {
        if (key.startsWith(`${tabId}:`)) forms.delete(key);
    }
    await Promise.allSettled(
        (frames ?? [])
            .filter((frame) => new URL(frame.url).origin === origin)
            .map((frame) =>
                messaging.sendMessage('rediscoverForms', undefined, {
                    tabId,
                    frameId: frame.frameId,
                })
            )
    );
}

onPopupMessage('getPopupView', async ({ data }) => {
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
            hasVaultKey: false,
            pending: null,
            targets: [],
        };
    }
    if (permission) await refreshForms(tabs[0], instance);
    const [user, vaults] = await Promise.all([
        executeUserDetailsRequest(instance),
        executeUserVaultsRequest(instance),
    ]);
    const preferences = await selectedVaultsSetting.getValue();
    const preferenceKey = JSON.stringify([instance, user.userId]);
    const preferred = data.vaultId ?? preferences[preferenceKey];
    const selected =
        vaults.find((vault) => vault.vaultId === preferred)?.vaultId ??
        vaults.find((vault) => vault.isOnline)?.vaultId ??
        vaults[0]?.vaultId;
    if (selected && preferences[preferenceKey] !== selected) {
        await selectedVaultsSetting.setValue({
            ...preferences,
            [preferenceKey]: selected,
        });
    }
    const selectedVault = vaults.find((vault) => vault.vaultId === selected);
    const offline = selectedVault?.isOnline === false;
    let entries: Entry[] = [];
    let vaultUnavailable = false;
    if (selected && !offline) {
        try {
            entries = await listEntries(selected, instance);
        } catch (error) {
            if (!(error instanceof ApiError) || error.status !== 503)
                throw error;
            vaultUnavailable = true;
        }
    }
    const hasVaultKey = selected
        ? Boolean(
              await wrappedKeys.read({
                  instance,
                  accountId: user.userId,
                  vaultId: selected,
              })
          )
        : false;
    return {
        instance,
        theme,
        permission,
        account: { userId: user.userId, username: user.username },
        selected,
        vaults,
        entries,
        hasVaultKey,
        vaultUnavailable,
        pending: pending.metadata() ?? null,
        targets: [...forms.values()]
            .flat()
            .filter((target) => target.tabId === tabs[0]?.id),
    };
});

onPageMessage('getVaults', ['/popup.html', '/action.html'], async () => {
    await ready;
    const instance = await getInstance();
    const [user, vaults] = await Promise.all([
        executeUserDetailsRequest(instance),
        executeUserVaultsRequest(instance),
    ]);

    return { scope: { instance, accountId: user.userId }, vaults };
});

async function actionContext(request: ActionRequest) {
    await ready;
    requireSignedIn();
    const instance = await getInstance();
    const [user, identifier] = await Promise.all([
        executeUserDetailsRequest(instance),
        lastIdentifierSetting.getValue(),
        requireUserVault(request.vaultId, instance),
    ]);
    const deviceId = identifier
        ? await loadDeviceId(instance, identifier)
        : null;
    if (!deviceId) throw new Error('Sign in again to identify this browser.');
    return {
        id: crypto.randomUUID(),
        scope: {
            instance,
            accountId: user.userId,
            vaultId: request.vaultId,
        },
        userId: user.userId,
        deviceId,
        deadline: Date.now() + 120_000,
    };
}

async function requestedEntry(request: ActionRequest, instance: string) {
    if (!request.passwordId) return undefined;
    const entry = (await listEntries(request.vaultId, instance)).find(
        (entry) => entry.passwordId === request.passwordId
    );
    if (!entry) throw new Error('This password is no longer available.');
    return entry;
}

function requireKnownTarget(target: Target) {
    const known = forms
        .get(`${target.tabId}:${target.frameId}`)
        ?.some(
            (form) =>
                form.documentId === target.documentId &&
                form.origin === target.origin &&
                form.formId === target.formId &&
                form.passwordId === target.passwordId &&
                form.usernameId === target.usernameId
        );
    if (!known) throw new Error('The login form changed. Try again.');
}

for (const [name, operation] of [
    ['handleCopyPassword', 'copy-password'],
    ['handleFill', 'fill'],
    ['handleSave', 'save'],
] as const) {
    onPopupMessage(name, async ({ data }) => {
        const base = await actionContext(data);
        const entry = await requestedEntry(data, base.scope.instance);
        if (operation === 'save') {
            const candidate = pending.metadata();
            if (!candidate) throw new Error('Capture is unavailable.');
            if (
                entry &&
                (!matchesSite(entry.address, candidate.origin) ||
                    entry.identifier !== candidate.identifier)
            ) {
                throw new Error(
                    'The captured login does not match this password.'
                );
            }
            pending.handoff(candidate.id, base.scope.accountId);
            await actions.open({
                ...base,
                operation,
                entry,
                candidateId: candidate.id,
                sourceTabId: candidate.tabId,
                candidateIdentifier: candidate.identifier,
                candidateOrigin: candidate.origin,
                candidateDeadline: candidate.deadline,
                deadline: candidate.deadline,
            });
        } else {
            if (!entry) throw new Error('Choose a password.');
            const target =
                operation === 'fill'
                    ? targetSchema.parse(data.target)
                    : undefined;
            if (target) {
                requireKnownTarget(target);
                if (!matchesSite(entry.address, target.origin))
                    throw new Error(
                        'This password does not match the login site.'
                    );
            }
            await actions.open({ ...base, operation, entry, target });
        }
    });
}

onPopupMessage('handleSyncSend', async ({ data }) => {
    const base = await actionContext(data);
    const receivers = await executeGetPendingReceiversRequest(
        undefined,
        base.scope.instance
    );
    const receiver = receivers.find(
        (receiver) =>
            receiver.code === data.code && receiver.vaultId === data.vaultId
    );
    if (!receiver)
        throw new Error('This receiving code is unavailable or expired.');
    await verifyReceiverDetails(
        receiver,
        await executeGetDeviceIdentityKeyRequest(
            receiver.receiverId,
            undefined,
            base.scope.instance
        )
    );
    await actions.open({
        ...base,
        operation: 'sync-send',
        code: data.code,
        receiver,
    });
});

onPopupMessage('handleSyncReceive', async ({ data }) => {
    const base = await actionContext(data);
    await actions.open({
        ...base,
        operation: 'sync-receive',
        deadline: Date.now() + 300_000,
    });
});

async function requireContent(sender: chrome.runtime.MessageSender) {
    await ready;
    const source = contentSource(sender, await getInstance());
    if (!(await chrome.permissions.contains({ origins: ['https://*/*'] }))) {
        throw new Error('Website access is disabled.');
    }
    return source;
}

function requireSignedIn() {
    if (!tokenStorage.get()) throw new Error('Sign in to Mossy first.');
}

messaging.onMessage('handleDiscover', async ({ data, sender }) => {
    const source = await requireContent(sender);
    const { forms: discovered } = discoverSchema.parse(data);
    if (discovered.some((form) => form.origin !== source.origin))
        throw new Error('The form origin does not match its document.');
    forms.set(
        `${source.tabId}:${source.frameId}`,
        discovered.map((form) => ({ ...form, ...source }))
    );
    return { status: 'ok' };
});

onPopupMessage('handleDismiss', () => {
    pending.clear();
    return { status: 'ok' };
});

onPopupMessage('setTheme', async ({ data }) => {
    await themeSetting.setValue(data.theme);
    theme = data.theme;
    return { status: 'ok' };
});

messaging.onMessage('handleCapture', async ({ data, sender }) => {
    const receivedAt = Date.now();
    try {
        const source = await requireContent(sender);
        requireSignedIn();
        captureSchema.parse(data);
        if (data.origin !== source.origin)
            throw new Error('The capture origin does not match its document.');
        const { userId } = await executeUserDetailsRequest(await getInstance());
        actions.cancelCaptures();
        const staged = await pending.stage(
            data.password,
            {
                origin: source.origin,
                identifier: data.identifier,
                tabId: source.tabId,
                account: userId,
            },
            receivedAt
        );
        if (staged) {
            await chrome.action.openPopup().catch(async () => {
                if (pending.metadata()?.id !== staged.id) return;
                await chrome.action.setBadgeBackgroundColor({
                    color: '#007735',
                });
                await chrome.action.setBadgeText({ text: 'Save' });
            });
        }
        return { status: staged ? 'ok' : 'error' };
    } finally {
        data.password = '';
    }
});

onPopupMessage('handleSettings', async ({ data }) => {
    await ready;
    validateInstance(data.instance, import.meta.env.DEV);
    const instance = await getInstance();
    if (data.instance !== instance) {
        resetSession();
        forms.clear();
        await executeExtensionLogoutRequest(instance).catch(() => undefined);
        await setInstance(data.instance);
    }
    await themeSetting.setValue(data.theme);
    theme = data.theme;
    return { status: 'ok' };
});

registerAuthHandlers({ ready, resetSession });
