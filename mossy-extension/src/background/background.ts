import { z } from 'zod';
import {
    authenticateDevice,
    verifyReceiverDetails,
    waitForReceiverResult,
    type ReceiverDetails,
    type VaultKeyResponse,
    type PublicIdentityJwk,
} from '@mossy/client-core';
import { wrappedKeys } from '../storage/wrappedKeys';
import {
    deviceSigner,
    loadDeviceId,
    saveDeviceId,
} from '../storage/deviceIdentity';
import { ExtensionTransport } from '../api/ExtensionTransport';
import { PendingCapture } from '../capture/PendingCapture';
import {
    DEFAULT_INSTANCE,
    normalizeInstance,
    commandSchema,
    contentMessageSchema,
    contentSource,
    trustedPage,
    matchesSite,
    assertLive,
    type Target,
} from '../security/security';
import type { Vault, Entry, Action } from '../types/models';
import {
    instanceSetting,
    themeSetting,
    lastIdentifierSetting,
    saveSettings,
} from '../storage/settings';

let instance = DEFAULT_INSTANCE;
let theme: 'light' | 'dark' | 'system' = 'system';
let account: { userId: string; username: string } | undefined;
let deviceId: string | undefined;
let api: ExtensionTransport;
let generation = 0;

function sessionGuard() {
    const epoch = generation;
    const current = api;
    const user = account?.userId;

    return () => {
        if (
            epoch !== generation ||
            api !== current ||
            account?.userId !== user
        ) {
            throw new Error('Account changed.');
        }
    };
}

const actions = new Map<
    string,
    {
        action: Action;
        windowId: number;
        tabId: number;
        claimed: boolean;
        port?: chrome.runtime.Port;
        controller: AbortController;
        events?: Response;
        dispatched?: boolean;
        timer: ReturnType<typeof setTimeout>;
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

function clearSession() {
    generation++;

    if (api) {
        api.token = null;
    }

    account = undefined;
    deviceId = undefined;
    pending.clear();
    forms.clear();

    for (const id of actions.keys()) {
        closeAction(id);
    }

    notify();
}

function closeAction(id: string) {
    const state = actions.get(id);

    if (!state) {
        return;
    }

    actions.delete(id);
    clearTimeout(state.timer);
    state.controller.abort();
    void state.events?.body?.cancel().catch(() => undefined);
    state.port?.disconnect();
    void chrome.windows.remove(state.windowId).catch(() => undefined);

    if (state.action.candidateId) {
        pending.clearIf(state.action.candidateId);
    }
}

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

    api = new ExtensionTransport(instance, clearSession);

    try {
        await api.refresh();
        await loadAccount();
    } catch {
        /* signed out; login reports upgrade/network errors */
    }

    await configureCapture();
})();

async function loadAccount() {
    const current = api;
    const epoch = generation;
    const user = await api.request<{ userId: string; username: string }>(
        '/api/v1/auth/user/me'
    );

    if (current !== api || epoch !== generation) {
        throw new Error('Account changed.');
    }

    const storedIdentifier = await lastIdentifierSetting.getValue();
    const loadedDeviceId =
        storedIdentifier !== null
            ? ((await loadDeviceId(instance, storedIdentifier)) ?? undefined)
            : undefined;

    if (current !== api || epoch !== generation) {
        throw new Error('Account changed.');
    }

    account = user;
    deviceId = loadedDeviceId;
}

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

    for (const [id, state] of actions) {
        if (
            state.tabId === tabId ||
            state.action.target?.tabId === tabId ||
            state.action.sourceTabId === tabId
        ) {
            closeAction(id);
        }
    }
});

chrome.windows.onRemoved.addListener((windowId) => {
    for (const [id, state] of actions) {
        if (state.windowId === windowId) {
            closeAction(id);
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

    for (const [id, state] of actions) {
        if (
            state.action.target?.tabId === details.tabId &&
            state.action.target.frameId === details.frameId
        ) {
            closeAction(id);
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

    if (!account || data.origin !== source.origin) {
        throw new Error('Capture unavailable.');
    }

    const capturedAccount = account.userId;

    // A newer submission replaces the earlier candidate and its authorization.
    for (const [id, state] of actions) {
        if (state.action.candidateId) {
            closeAction(id);
        }
    }

    // Encryption is the first asynchronous secret operation. No API or prompt precedes staging.
    const staged = await pending.stage(
        data.password,
        {
            origin: source.origin,
            identifier: data.identifier,
            tabId: source.tabId,
            account: capturedAccount,
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

    if (account?.userId !== capturedAccount) {
        pending.clearIf(staged.id);

        return { ok: false };
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
    return (
        await api.request<Entry[]>(
            `/api/v1/passwords/metadata?vaultId=${encodeURIComponent(vaultId)}`
        )
    ).filter((entry) => entry.passwordType === 'PASSWORD');
}

async function state(vaultId?: string) {
    const guard = sessionGuard();
    const permission = await chrome.permissions.contains({
        origins: ['https://*/*'],
    });
    guard();

    if (!account) {
        return {
            instance,
            theme,
            permission,
            account: null,
            pending: null,
            vaults: [],
            entries: [],
            targets: [],
        };
    }

    const vaults = await api.request<Vault[]>('/api/v1/passwords/vault/vaults');
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
    guard();

    return {
        instance,
        theme,
        permission,
        account,
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
    command: Extract<z.infer<typeof commandSchema>, { kind: 'action' }>
) {
    if (!account || !deviceId) {
        throw new Error('Sign in again to verify your device.');
    }

    const guard = sessionGuard();
    const user = account;
    const sourceDevice = deviceId;
    const vaults = await api.request<Vault[]>('/api/v1/passwords/vault/vaults');
    guard();

    const vault = vaults.find((vault) => vault.vaultId === command.vaultId);

    if (!vault) {
        throw new Error('Unknown vault.');
    }

    const entries = await listEntries(command.vaultId);
    guard();

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

        await revalidateTarget(target);
    }

    if (command.operation === 'save') {
        const candidate = pending.metadata();

        if (
            !candidate ||
            candidate.handedOff ||
            candidate.account !== account.userId
        ) {
            throw new Error('Captured password expired.');
        }

        const matches = entries.filter(
            (e) =>
                matchesSite(e.address, candidate.origin) &&
                e.identifier === candidate.identifier
        );

        if (
            matches.length &&
            (!entry || !matches.some((e) => e.passwordId === entry.passwordId))
        ) {
            throw new Error('Choose the entry to update.');
        }

        if (entry && !matches.some((e) => e.passwordId === entry.passwordId)) {
            throw new Error(
                'This entry does not match the captured site and identifier.'
            );
        }

        pending.handoff(candidate.id, account.userId);
        action.candidateId = candidate.id;
        action.sourceTabId = candidate.tabId;
        action.candidateIdentifier = candidate.identifier;
        action.candidateOrigin = candidate.origin;
        action.candidateDeadline = candidate.deadline;
        action.deadline = candidate.deadline;
    }

    if (command.operation === 'sync-send') {
        if (!command.code) {
            throw new Error('Enter a sync code.');
        }

        const receivers = await api.request<
            (ReceiverDetails & { code: string })[]
        >('/api/v1/key-sync/receivers');
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
            await api.request<PublicIdentityJwk>(
                `/api/v1/device-trust/device/${encodeURIComponent(receiver.receiverId)}/identity-key`
            )
        );
        guard();
        action.receiver = receiver;
    }

    if (command.operation === 'sync-receive') {
        action.deadline = Date.now() + 300000;
    }

    guard();
    assertLive(action.deadline);

    const window = await chrome.windows.create({
        url: chrome.runtime.getURL(`/action.html#${action.id}`),
        type: 'popup',
        width: 560,
        height: 620,
        focused: true,
    });
    const tabId = window?.tabs?.[0]?.id;

    if (window?.id === undefined || tabId === undefined) {
        throw new Error('Could not open authorization.');
    }

    try {
        guard();
        assertLive(action.deadline);
    } catch (error) {
        void chrome.windows.remove(window.id);
        throw error;
    }

    const timer = setTimeout(
        () => {
            const item = actions.get(action.id);

            if (item?.dispatched) {
                if (action.candidateId) {
                    pending.clearIf(action.candidateId);
                }

                return;
            }

            closeAction(action.id);
        },
        Math.max(0, action.deadline - Date.now())
    );
    actions.set(action.id, {
        action,
        windowId: window.id,
        tabId,
        claimed: false,
        controller: new AbortController(),
        timer,
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

chrome.runtime.onMessage.addListener((raw, sender, respond) => {
    if (raw?.kind === 'changed') {
        return;
    }

    const receivedAt = Date.now();
    const contentCapture =
        raw?.kind === 'capture' && !trustedPage(sender, '/popup.html');
    const work = contentCapture
        ? handleContent(raw, sender, receivedAt)
        : ready.then(async () => {
              if (!trustedPage(sender, '/popup.html')) {
                  return handleContent(raw, sender);
              }

              const command = commandSchema.parse(raw);

              if (command.kind === 'state') {
                  return state(command.vaultId);
              }

              if (command.kind === 'theme') {
                  await themeSetting.setValue(command.theme);
                  theme = command.theme;

                  return { ok: true };
              }

              if (command.kind === 'dismiss') {
                  pending.clear();

                  return { ok: true };
              }

              if (command.kind === 'logout') {
                  const retiring = api;
                  retiring.token = null;
                  clearSession();

                  await retiring.request('/api/v1/auth/extension/logout', {
                      method: 'POST',
                      anonymous: true,
                  });

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
                      const retiring = api;
                      retiring.token = null;
                      clearSession();

                      try {
                          await retiring.request(
                              '/api/v1/auth/extension/logout',
                              {
                                  method: 'POST',
                                  anonymous: true,
                              }
                          );
                      } catch {
                          /* Local teardown still succeeds if the old server is unavailable. */
                      }

                      instance = next;
                      api = new ExtensionTransport(instance, clearSession);
                  }

                  theme = command.theme;

                  await saveSettings(instance, theme);

                  return { ok: true };
              }

              if (command.kind === 'login') {
                  clearSession();
                  api.token = null;

                  const epoch = generation;
                  const currentInstance = instance;
                  const currentApi = api;
                  const result = await authenticateDevice({
                      transport: api,
                      signer: await deviceSigner(instance),
                      credentials: {
                          identifier: command.identifier,
                          password: command.password,
                      },
                      loginPath: '/api/v1/auth/extension/login',
                      loadDeviceId: () =>
                          loadDeviceId(currentInstance, command.identifier),
                      saveDeviceId: (id) =>
                          saveDeviceId(currentInstance, command.identifier, id),
                      userAgent: navigator.userAgent,
                  });
                  command.password = '';

                  if (epoch !== generation || api !== currentApi) {
                      throw new Error('Account changed.');
                  }

                  deviceId = result.deviceId;

                  await lastIdentifierSetting.setValue(command.identifier);

                  if (result.status === 'authenticated') {
                      api.token = result.accessToken;

                      await loadAccount();
                  }

                  return result;
              }

              if (command.kind === 'action') {
                  return createAction(command);
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
    if (
        trustedPage(port.sender ?? {}, '/popup.html') &&
        port.name === 'popup'
    ) {
        port.onDisconnect.addListener(() => {
            if (!pending.metadata()?.handedOff) {
                pending.clear();
            }
        });

        return;
    }

    if (
        !trustedPage(port.sender ?? {}, '/action.html') ||
        !port.name.startsWith('action:')
    ) {
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
    item.port = port;
    port.onDisconnect.addListener(() => closeAction(id));

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
                const sameSession = sessionGuard();

                const guard = () => {
                    sameSession();

                    if (
                        actions.get(id) !== item ||
                        item.controller.signal.aborted
                    ) {
                        throw new Error('Action canceled.');
                    }
                };

                const action = item.action;
                assertLive(action.deadline);

                if (
                    account?.userId !== action.scope.account ||
                    instance !== action.scope.instance ||
                    !api.token
                ) {
                    throw new Error('Account changed.');
                }

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

                    result = await api.request(
                        `/api/v1/passwords/ciphertext/${encodeURIComponent(action.entry.passwordId)}?vaultId=${encodeURIComponent(action.scope.vault)}`,
                        { signal: item.controller.signal }
                    );
                } else if (request.kind === 'candidate') {
                    if (
                        action.operation !== 'save' ||
                        !action.candidateId ||
                        consumed
                    ) {
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

                    item.events = await api.receiverEvents(
                        item.controller.signal
                    );
                    guard();

                    const response = await api.request<{ code: string }>(
                        '/api/v1/key-sync',
                        {
                            method: 'POST',
                            body: JSON.stringify({
                                vaultId: receiver.vaultId,
                                publicDh: receiver.publicDh,
                                signature: receiver.signature,
                            }),
                            signal: item.controller.signal,
                        }
                    );
                    guard();
                    action.receiver = receiver;
                    action.code = response.code;
                    result = { code: response.code };
                } else if (request.kind === 'wait') {
                    if (
                        action.operation !== 'sync-receive' ||
                        !action.code ||
                        !action.receiver
                    ) {
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
                    guard();
                    assertLive(action.deadline);

                    const keys = await api.request<{
                        keys: VaultKeyResponse[];
                    }>('/api/v1/key-sync/vault-keys', {
                        signal: item.controller.signal,
                    });
                    guard();

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
                        senderIdentity: await api.request(
                            `/api/v1/device-trust/device/${encodeURIComponent(transfer.senderId)}/identity-key`,
                            { signal: item.controller.signal }
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

                    await wrappedKeys.write(action.scope, record, () => {
                        guard();
                        assertLive(action.deadline);
                    });
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
                        assertLive(action.deadline);

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

                        assertLive(action.deadline);

                        if (value.unchanged) {
                            result = { status: 'unchanged' };
                        } else {
                            if (!value.ciphertext) {
                                throw new Error('Missing encrypted password.');
                            }

                            const payload = {
                                vaultId: action.scope.vault,
                                identifier: action.candidateIdentifier,
                                address: action.candidateOrigin,
                                cipherText: value.ciphertext,
                                ...(action.entry
                                    ? { passwordId: action.entry.passwordId }
                                    : { passwordType: 'PASSWORD' }),
                            };
                            guard();
                            assertLive(action.deadline);
                            item.dispatched = true;

                            await api.request(
                                action.entry
                                    ? '/api/v1/passwords/update'
                                    : '/api/v1/passwords/save',
                                {
                                    method: action.entry ? 'PATCH' : 'POST',
                                    body: JSON.stringify(payload),
                                    signal: item.controller.signal,
                                    beforeDispatch: () => {
                                        guard();
                                        assertLive(action.deadline);
                                    },
                                }
                            );
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

                        await api.request(
                            `/api/v1/key-sync/${encodeURIComponent(action.code!)}`,
                            {
                                method: 'POST',
                                body: JSON.stringify(value),
                                signal: item.controller.signal,
                            }
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

                guard();

                if (!item.dispatched) {
                    assertLive(action.deadline);
                }

                port.postMessage({ id: request.id, result });

                if (finished) {
                    clearTimeout(item.timer);
                    setTimeout(() => closeAction(id), 200);
                }
            } finally {
                busy = false;
            }
        })().catch((error) => {
            try {
                port.postMessage({
                    id: raw?.id,
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Action failed.',
                });
            } finally {
                closeAction(id);
            }
        });
    });
});
