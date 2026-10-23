import { executeUserDetailsRequest } from 'mossy-api-client/auth.api';
import { executeUserVaultsRequest } from 'mossy-api-client/vault.api';
import { executeGetDeviceIdentityKeyRequest } from 'mossy-api-client/deviceTrust.api';
import {
    executePasswordMetadataRequest,
} from 'mossy-api-client/password.api';
import {
    executeGetPendingReceiversRequest,
    executeInitKeySyncRequest,
    type InitKeySyncRequest,
} from 'mossy-api-client/keySync.api';
import { tokenStorage } from 'mossy-api-client/tokenStorage';
import {
    executeExtensionRefreshRequest,
    executeExtensionLogoutRequest,
} from 'mossy-api-client/extension/auth.api';
import { messaging } from '../messaging/rpc';
import { verifyReceiverDetails } from '../actions/keySync';
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

messaging.onMessage('offerKeySync', async ({ data }) => {
    const receiverDetails = data.receiver

    const request: InitKeySyncRequest = {
        vaultId: receiverDetails.vaultId,
        publicDh: receiverDetails.publicDh,
        signature: receiverDetails.signature
    }

    return await executeInitKeySyncRequest(request, undefined, await getInstance())
})

messaging.onMessage('waitForKeySync', ({data}) => {
    data.actionId
})

messaging.onMessage('finishCopyPassword', ({ data }) => {
    // TODO: Acknowledge the clipboard write and consume data.actionId.

    
    throw new Error(
        `finishCopyPassword is not implemented (action ${data.actionId}).`
    );
});

messaging.onMessage('finishCopyUsername', ({ data }) => {
    // TODO: Acknowledge the clipboard write and consume data.actionId.
    throw new Error(
        `finishCopyUsername is not implemented (action ${data.actionId}).`
    );
});

messaging.onMessage('finishFill', ({ data }) => {
    // TODO: Send data.password to the action's target with fillOnce, then consume the action.
    throw new Error(
        `finishFill is not implemented (action ${data.actionId}).`
    );
});

messaging.onMessage('finishSave', ({ data }) => {
    // TODO: Skip unchanged entries, otherwise save/update data.ciphertext; consume the action.
    throw new Error(
        `finishSave is not implemented (action ${data.actionId}).`
    );
});

messaging.onMessage('finishKeySyncSend', ({ data }) => {
    // TODO: Upload data.value using the stored action's code and instance; consume the action.
    throw new Error(
        `finishKeySyncSend is not implemented (action ${data.actionId}).`
    );
});

messaging.onMessage('finishKeySyncReceive', ({ data }) => {
    // TODO: Store data.value as a wrapped-key record for the action's scope; consume the action.
    throw new Error(
        `finishKeySyncReceive is not implemented (action ${data.actionId}).`
    );
});

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

messaging.onMessage('handleCopyPassword', async ({ data }) => {
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
        operation: 'copy-password',
        scope: { instance, account: user.userId, vault: data.vaultId },
        userId: user.userId,
        vaultName: vault.vaultName,
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
        operation: 'fill',
        scope: { instance, account: user.userId, vault: data.vaultId },
        userId: user.userId,
        vaultName: vault.vaultName,
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
    const candidate = pending.metadata()!;
    pending.handoff(candidate.id, user.userId);
    const action: Action = {
        id: crypto.randomUUID(),
        operation: 'save',
        scope: { instance, account: user.userId, vault: data.vaultId },
        userId: user.userId,
        vaultName: vault.vaultName,
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
    const [user, vaults, deviceId] = await Promise.all([
        executeUserDetailsRequest(instance),
        executeUserVaultsRequest(instance),
        lastIdentifierSetting
            .getValue()
            .then((identifier) => loadDeviceId(instance, identifier!)),
    ]);
    const vault = vaults.find((vault) => vault.vaultId === data.vaultId)!;
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
        scope: { instance, account: user.userId, vault: data.vaultId },
        userId: user.userId,
        vaultName: vault.vaultName,
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
    const [user, vaults, deviceId] = await Promise.all([
        executeUserDetailsRequest(instance),
        executeUserVaultsRequest(instance),
        lastIdentifierSetting
            .getValue()
            .then((identifier) => loadDeviceId(instance, identifier!)),
    ]);
    const vault = vaults.find((vault) => vault.vaultId === data.vaultId)!;
    const action: Action = {
        id: crypto.randomUUID(),
        operation: 'sync-receive',
        scope: { instance, account: user.userId, vault: data.vaultId },
        userId: user.userId,
        vaultName: vault.vaultName,
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

    return { status: 'ok' }
})

messaging.onMessage('handleDismiss', () => {
    pending.clear();
    return { status: 'ok' };
})

messaging.onMessage('setTheme', async ({ data }) => {
    await themeSetting.setValue(data.theme);
    theme = data.theme;
    return { status: 'ok' };
})

messaging.onMessage('handleCapture', async ({data, sender}) => {
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

    return { status: staged ? 'ok' : "error" };
})

messaging.onMessage('handleSettings', async ({data}) => {
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
    return { status: 'ok' };
})

type WrappedKeyPayload = { wrappedKey: number[] } & (
    | { type: 'PRF'; credentialId: number[] }
    | { type: 'Password'; salt: number[] }
);
