import { z } from 'zod';
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
import { PendingCapture } from '../capture/PendingCapture';
import {
    DEFAULT_INSTANCE,
    normalizeInstance,
    contentMessageSchema,
    contentSource,
    matchesSite,
    type Target,
} from '../security/security';
import type { Action, Command } from '../types/models';
import {
    instanceSetting,
    themeSetting,
    saveSettings,
} from '../storage/settings';

let instance = DEFAULT_INSTANCE;
let theme: 'light' | 'dark' | 'system' = 'system';
let deviceId: string | undefined;

const actions = new Map<
    string,
    {
        action: Action;
        tabId: number;
        claimed: boolean;
        controller: AbortController;
        events?: Response;
    }
>();

const forms = new Map<string, Target[]>();

const notify = () => {
    void chrome.runtime.sendMessage({ kind: 'changed' }).catch(() => undefined);
};

const pending = new PendingCapture(() => {
    notify();

    if (!pending.metadata()) {
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

    const [storedInstance, storedTheme] = await Promise.all([
        instanceSetting.getValue(),
        themeSetting.getValue(),
    ]);

    try {
        instance = normalizeInstance(storedInstance, import.meta.env.DEV);
    } catch {
        instance = DEFAULT_INSTANCE;
    }

    theme = storedTheme;

    const response = await executeExtensionRefreshRequest(instance);
    const { accessToken } = await response.json();
    tokenStorage.set(accessToken);

    await configureCapture();
})();

async function configureCapture() {
    const permission = await chrome.permissions.contains({
        origins: ['https://*/*'],
    });

    await chrome.scripting
        .unregisterContentScripts({ ids: ['mossy-capture'] })
        .catch(() => undefined);

    if (permission) {
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

    return permission;
}

chrome.permissions.onAdded.addListener(() => {
    void ready.then(configureCapture);
});

chrome.permissions.onRemoved.addListener(() => {
    forms.clear();
    pending.clear();
    void ready.then(configureCapture);
});

chrome.tabs.onRemoved.addListener((tabId) => {
    if (pending.metadata()?.tabId === tabId) {
        pending.clear();
    }

    for (const [key, list] of forms) {
        if (list[0]?.tabId === tabId) {
            forms.delete(key);
        }
    }
});

chrome.webNavigation.onCommitted.addListener((details) => {
    for (const [key, list] of forms) {
        if (
            list[0]?.tabId === details.tabId &&
            list[0]?.frameId === details.frameId
        ) {
            forms.delete(key);
        }
    }
});

async function handleContent(
    raw: unknown,
    sender: chrome.runtime.MessageSender,
    receivedAt = Date.now()
) {
    const data = contentMessageSchema.parse(raw);
    const source = contentSource(sender, instance);

    if (data.kind === 'discover') {
        if (
            !(await chrome.permissions.contains({ origins: ['https://*/*'] }))
        ) {
            throw new Error('Site access is disabled.');
        }

        const targets = data.forms
            .filter((form) => form.origin === source.origin)
            .map((form) => ({ ...form, ...source }));
        forms.set(`${source.tabId}:${source.frameId}`, targets);

        return { ok: true };
    }

    if (data.origin !== source.origin) {
        throw new Error('Capture unavailable.');
    }

    const { userId } = await executeUserDetailsRequest(instance);

    // Encrypt the captured password before opening the prompt.
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
    data.password = '';

    if (!staged) {
        return { ok: false };
    }

    if (!(await chrome.permissions.contains({ origins: ['https://*/*'] }))) {
        pending.clearIf(staged.id);
        throw new Error('Site access is disabled.');
    }

    try {
        if (pending.metadata()?.id !== staged.id) {
            return { ok: false };
        }

        await chrome.action.openPopup();
    } catch {
        if (pending.metadata()?.id === staged.id) {
            await chrome.action.setBadgeBackgroundColor({ color: '#007735' });
            await chrome.action.setBadgeText({ text: 'Save' });
        }
    }

    return { ok: true };
}

async function listEntries(vaultId: string) {
    return (await executePasswordMetadataRequest(vaultId, instance)).filter(
        (entry) => entry.passwordType === 'PASSWORD'
    );
}

async function state(vaultId?: string) {
    const permission = await chrome.permissions.contains({
        origins: ['https://*/*'],
    });

    const [user, vaults] = await Promise.all([
        executeUserDetailsRequest(instance),
        executeUserVaultsRequest(instance),
    ]);
    const selected =
        vaultId && vaults.some((v) => v.vaultId === vaultId)
            ? vaultId
            : vaults[0]?.vaultId;
    const tabs = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
    });
    const tab = tabs[0];
    const entries = selected ? await listEntries(selected) : [];

    return {
        instance,
        theme,
        permission,
        account: { userId: user.userId, username: user.username },
        selected,
        vaults,
        entries,
        pending: pending.metadata() ?? null,
        targets: [...forms.values()]
            .flat()
            .filter((target) => target.tabId === tab?.id),
    };
}

async function createAction(
    command: Extract<Command, { kind: 'action' }>
) {
    if (!deviceId) {
        throw new Error('Sign in again to verify your device.');
    }

    const sourceDevice = deviceId;
    const [user, vaults] = await Promise.all([
        executeUserDetailsRequest(instance),
        executeUserVaultsRequest(instance),
    ]);

    const vault = vaults.find((vault) => vault.vaultId === command.vaultId);

    if (!vault) {
        throw new Error('Unknown vault.');
    }

    const entries = await listEntries(command.vaultId);

    const entry = entries.find((e) => e.passwordId === command.passwordId);

    if (
        ['copy-password', 'copy-username', 'fill'].includes(
            command.operation
        ) &&
        !entry
    ) {
        throw new Error('Choose a password.');
    }

    const action: Action = {
        id: crypto.randomUUID(),
        operation: command.operation,
        scope: { instance, account: user.userId, vault: command.vaultId },
        userId: user.userId,
        vaultName: vault.vaultName,
        deviceId: sourceDevice,
        entry,
        deadline: Date.now() + 120000,
        code: command.code,
    };

    if (command.operation === 'fill') {
        const target = command.target;

        if (
            !target ||
            !matchesSite(entry!.address, target.origin) ||
            ![...forms.values()]
                .flat()
                .some(
                    (f) =>
                        f.tabId === target.tabId &&
                        f.frameId === target.frameId &&
                        f.documentId === target.documentId &&
                        f.origin === target.origin &&
                        f.formId === target.formId &&
                        f.passwordId === target.passwordId &&
                        f.usernameId === target.usernameId
                )
        ) {
            throw new Error('Choose a matching visible form.');
        }

        if (
            !(await chrome.permissions.contains({ origins: ['https://*/*'] }))
        ) {
            throw new Error('Site access is disabled.');
        }

        action.target = target;
    }

    if (command.operation === 'save') {
        const candidate = pending.metadata();

        if (!candidate) {
            throw new Error('Captured password expired.');
        }

        const matches = entries.filter(
            (e) =>
                matchesSite(e.address, candidate.origin) &&
                e.identifier === candidate.identifier
        );

        if (matches.length && !entry) {
            throw new Error('Choose the entry to update.');
        }

        if (entry && !matches.some((e) => e.passwordId === entry.passwordId)) {
            throw new Error(
                'This entry does not match the captured site and identifier.'
            );
        }

        pending.handoff(candidate.id, user.userId);
        action.candidateId = candidate.id;
        action.sourceTabId = candidate.tabId;
        action.candidateIdentifier = candidate.identifier;
        action.candidateOrigin = candidate.origin;
        action.candidateDeadline = candidate.deadline;
        action.deadline = candidate.deadline;
    }

    if (command.operation === 'sync-send') {
        const receivers = await executeGetPendingReceiversRequest(
            undefined,
            instance
        );
        const receiver = receivers.find(
            (r) =>
                r.code === command.code &&
                r.vaultId === command.vaultId &&
                r.receiverId !== deviceId
        );

        if (!receiver) {
            throw new Error('Sync receiver unavailable.');
        }

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

    if (command.operation === 'sync-receive') {
        action.deadline = Date.now() + 300000;
    }

    const window = await chrome.windows.create({
        url: chrome.runtime.getURL(`/action.html#${action.id}`),
        type: 'popup',
        width: 560,
        height: 620,
        focused: true,
    });
    const tabId = window?.tabs?.[0]?.id;

    if (tabId === undefined) {
        throw new Error('Could not open authorization.');
    }

    actions.set(action.id, {
        action,
        tabId,
        claimed: false,
        controller: new AbortController(),
    });

    return { ok: true };
}

async function revalidateTarget(target: Target) {
    const frame = await chrome.webNavigation.getFrame({
        tabId: target.tabId,
        frameId: target.frameId,
    });
    const tab = await chrome.tabs.get(target.tabId);

    if (
        !frame ||
        frame.documentId !== target.documentId ||
        new URL(frame.url).origin !== target.origin ||
        !tab.url ||
        new URL(tab.url).origin !== target.origin
    ) {
        throw new Error('The target page changed.');
    }

    const result = await chrome.tabs.sendMessage(
        target.tabId,
        { kind: 'validate-fill', target },
        { documentId: target.documentId }
    );

    if (!result?.valid) {
        throw new Error('The selected fields changed.');
    }
}

messaging.onMessage('getPopupView', async ({ data }) => {
    await ready;
    return state(data.vaultId);
});

messaging.onMessage('handleAction', async ({ data }) => {
    await ready;
    await createAction({ ...data, kind: 'action' });
});

chrome.runtime.onMessage.addListener((raw, sender, respond) => {
    if (
        !['discover', 'capture', 'theme', 'settings', 'dismiss'].includes(
            raw?.kind
        )
    )
        return;
    const receivedAt = Date.now();
    const contentCapture = raw.kind === 'capture';
    const work = contentCapture
        ? handleContent(raw, sender, receivedAt)
        : ready.then(async () => {
              if (raw.kind === 'discover') {
                  return handleContent(raw, sender);
              }

              const command = raw as Command;

              if (command.kind === 'theme') {
                  await themeSetting.setValue(command.theme);
                  theme = command.theme;

                  return { ok: true };
              }

              if (command.kind === 'dismiss') {
                  pending.clear();

                  return { ok: true };
              }

              if (command.kind === 'settings') {
                  const next = normalizeInstance(
                      command.instance,
                      import.meta.env.DEV
                  );

                  if (
                      !(await chrome.permissions.contains({
                          origins: [`${next}/*`],
                      }))
                  ) {
                      throw new Error(
                          'Grant host access to this instance first.'
                      );
                  }

                  if (next !== instance) {
                      const retiring = instance;

                      try {
                          await executeExtensionLogoutRequest(retiring);
                      } catch {
                          /* Local teardown still succeeds if the old server is unavailable. */
                      }

                      instance = next;
                  }

                  theme = command.theme;

                  await saveSettings(instance, theme);

                  return { ok: true };
              }

              throw new Error('Unsupported command.');
          });
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

// Only a single port from the exact action window may access each action's narrow command set.
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'popup') {
        port.onDisconnect.addListener(() => {
            if (!pending.metadata()?.handedOff) {
                pending.clear();
            }
        });

        return;
    }

    if (!port.name.startsWith('action:')) {
        port.disconnect();

        return;
    }

    const id = port.name.slice(7);
    const item = actions.get(id);

    if (!item || item.claimed || port.sender?.tab?.id !== item.tabId) {
        port.disconnect();

        return;
    }

    item.claimed = true;
    port.onDisconnect.addListener(() => actions.delete(id));

    const requestSchema = z
        .object({
            id: z.uuid(),
            kind: z.enum([
                'claim',
                'ciphertext',
                'candidate',
                'finish',
                'offer',
                'wait',
                'receive-finish',
            ]),
            value: z.unknown().optional(),
        })
        .strict();
    let busy = false;
    let finished = false;
    let consumed = false;
    port.onMessage.addListener((raw) => {
        void (async () => {
            const request = requestSchema.parse(raw);

            if (busy || finished) {
                throw new Error('Action already in progress.');
            }

            busy = true;

            try {
                const action = item.action;

                let result: unknown;

                if (request.kind === 'claim') {
                    result = action;
                } else if (request.kind === 'ciphertext') {
                    if (
                        !action.entry ||
                        !['copy-password', 'fill', 'save'].includes(
                            action.operation
                        )
                    ) {
                        throw new Error('No selected secret.');
                    }

                    result = await executePasswordCiphertextRequest(
                        action.entry.passwordId,
                        action.scope.vault,
                        instance,
                        item.controller.signal
                    );
                } else if (request.kind === 'candidate') {
                    if (!action.candidateId) {
                        throw new Error('Capture unavailable.');
                    }

                    consumed = true;
                    result = await pending.consume(
                        action.candidateId,
                        action.scope.account
                    );
                } else if (request.kind === 'offer') {
                    if (action.operation !== 'sync-receive' || action.code) {
                        throw new Error('Unexpected sync offer.');
                    }

                    const receiver = z
                        .object({
                            receiverId: z.string(),
                            vaultId: z.string(),
                            publicDh: z.object({
                                kty: z.literal('OKP'),
                                crv: z.literal('X25519'),
                                x: z.string(),
                            }),
                            signature: z.string(),
                        })
                        .strict()
                        .parse(request.value);

                    if (
                        receiver.receiverId !== action.deviceId ||
                        receiver.vaultId !== action.scope.vault
                    ) {
                        throw new Error('Invalid receiver.');
                    }

                    item.events = await executeSubscribeReceiverEventsRequest(
                        item.controller.signal,
                        instance
                    );

                    const response = await executeInitKeySyncRequest(
                        {
                            vaultId: receiver.vaultId,
                            publicDh: receiver.publicDh,
                            signature: receiver.signature,
                        },
                        item.controller.signal,
                        instance
                    );
                    action.receiver = receiver;
                    action.code = response.code;
                    result = { code: response.code };
                } else if (request.kind === 'wait') {
                    if (action.operation !== 'sync-receive' || !action.code) {
                        throw new Error('No active sync.');
                    }

                    if (!item.events) {
                        throw new Error('Missing sync subscription.');
                    }

                    await waitForReceiverResult(
                        item.events,
                        action.deviceId,
                        action.code
                    );

                    const keys = await executeGetVaultKeysRequest(
                        item.controller.signal,
                        instance
                    );

                    const transfer = keys.keys.find(
                        (k) =>
                            k.code === action.code &&
                            k.vaultId === action.scope.vault
                    );

                    if (!transfer) {
                        throw new Error(
                            'No encrypted key was found for this vault.'
                        );
                    }

                    result = {
                        transfer,
                        senderIdentity:
                            await executeGetDeviceIdentityKeyRequest(
                                transfer.senderId,
                                item.controller.signal,
                                instance
                            ),
                    };
                } else if (request.kind === 'receive-finish') {
                    if (action.operation !== 'sync-receive') {
                        throw new Error('Unexpected result.');
                    }

                    const value = z
                        .discriminatedUnion('type', [
                            z
                                .object({
                                    type: z.literal('PRF'),
                                    credentialId: z
                                        .array(z.number().int().min(0).max(255))
                                        .min(1)
                                        .max(1024),
                                    wrappedKey: z
                                        .array(z.number().int().min(0).max(255))
                                        .length(40),
                                })
                                .strict(),
                            z
                                .object({
                                    type: z.literal('Password'),
                                    wrappedKey: z
                                        .array(z.number().int().min(0).max(255))
                                        .length(40),
                                    salt: z
                                        .array(z.number().int().min(0).max(255))
                                        .length(16),
                                })
                                .strict(),
                        ])
                        .parse(request.value);
                    const wrappedKey = new Uint8Array(value.wrappedKey).buffer;
                    const record =
                        value.type === 'PRF'
                            ? {
                                  type: 'PRF' as const,
                                  credentialId: new Uint8Array(
                                      value.credentialId
                                  ).buffer,
                                  wrappedKey,
                              }
                            : {
                                  type: 'Password' as const,
                                  wrappedKey,
                                  salt: new Uint8Array(value.salt),
                              };

                    await wrappedKeys.write(action.scope, record);
                    finished = true;
                    result = { status: 'saved' };
                } else {
                    finished = true;

                    if (action.operation === 'fill') {
                        const value = z
                            .object({ password: z.string().max(65536) })
                            .strict()
                            .parse(request.value);

                        await revalidateTarget(action.target!);

                        await chrome.tabs.sendMessage(
                            action.target!.tabId,
                            {
                                kind: 'fill-once',
                                actionId: action.id,
                                target: action.target,
                                identifier: action.entry!.identifier,
                                password: value.password,
                            },
                            { documentId: action.target!.documentId }
                        );
                        value.password = '';
                        result = { status: 'filled' };
                    } else if (action.operation === 'save') {
                        const value = z
                            .object({
                                ciphertext: z.string().max(200000).optional(),
                                unchanged: z.boolean().optional(),
                            })
                            .strict()
                            .parse(request.value);

                        if (!consumed) {
                            throw new Error('Authorize before saving.');
                        }

                        if (value.unchanged) {
                            result = { status: 'unchanged' };
                        } else {
                            if (!value.ciphertext) {
                                throw new Error('Missing encrypted password.');
                            }

                            const payload = {
                                vaultId: action.scope.vault,
                                identifier: action.candidateIdentifier!,
                                address: action.candidateOrigin!,
                                cipherText: value.ciphertext,
                            };

                            await (action.entry
                                ? executeUpdatePasswordRequest(
                                      {
                                          ...payload,
                                          passwordId: action.entry.passwordId,
                                      },
                                      instance,
                                      item.controller.signal
                                  )
                                : executeSavePasswordRequest(
                                      { ...payload, passwordType: 'PASSWORD' },
                                      instance,
                                      item.controller.signal
                                  ));
                            result = { status: 'saved' };
                        }
                    } else if (action.operation === 'sync-send') {
                        const value = z
                            .object({
                                vaultId: z.string(),
                                ciphertext: z.string().max(20000),
                                publicDh: z.object({
                                    kty: z.literal('OKP'),
                                    crv: z.literal('X25519'),
                                    x: z.string(),
                                }),
                            })
                            .strict()
                            .parse(request.value);

                        if (value.vaultId !== action.scope.vault) {
                            throw new Error('Invalid transfer.');
                        }

                        await executeUploadVaultKeyRequest(
                            action.code!,
                            value,
                            item.controller.signal,
                            instance
                        );
                        result = { status: 'sent' };
                    } else if (
                        ['copy-password', 'copy-username'].includes(
                            action.operation
                        )
                    ) {
                        result = { status: 'copied' };
                    } else {
                        throw new Error('Unexpected result.');
                    }
                }

                port.postMessage({ id: request.id, result });
            } finally {
                busy = false;
            }
        })().catch((error) => {
            port.postMessage({
                id: raw?.id,
                error:
                    error instanceof Error ? error.message : 'Action failed.',
            });
        });
    });
});
