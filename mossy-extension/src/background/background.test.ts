import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtensionProtocol } from '../messaging/rpc';

const mocks = vi.hoisted(() => {
    const event = () => ({ addListener: vi.fn() });
    return {
        chrome: {
            runtime: {
                id: 'mossy',
                getPlatformInfo: vi.fn().mockResolvedValue({ os: 'linux' }),
                onMessage: event(),
                onConnect: event(),
                sendMessage: vi.fn().mockResolvedValue(undefined),
                getURL: (path: string) =>
                    `chrome-extension://mossy/${path.replace(/^\//, '')}`,
            },
            storage: {
                local: { setAccessLevel: vi.fn().mockResolvedValue(undefined) },
                session: {
                    setAccessLevel: vi.fn().mockResolvedValue(undefined),
                },
            },
            permissions: {
                contains: vi.fn().mockResolvedValue(true),
                onAdded: event(),
                onRemoved: event(),
            },
            scripting: {
                unregisterContentScripts: vi.fn().mockResolvedValue(undefined),
                registerContentScripts: vi.fn().mockResolvedValue(undefined),
            },
            tabs: {
                onRemoved: event(),
                query: vi.fn().mockResolvedValue([{ id: 7 }]),
                sendMessage: vi.fn().mockResolvedValue({ valid: true }),
            },
            windows: {
                create: vi.fn().mockResolvedValue({ id: 12 }),
                remove: vi.fn().mockResolvedValue(undefined),
            },
            webNavigation: {
                onCommitted: event(),
                getAllFrames: vi.fn().mockResolvedValue([]),
            },
            action: {
                openPopup: vi.fn().mockResolvedValue(undefined),
                setBadgeText: vi.fn().mockResolvedValue(undefined),
                setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
            },
        },
        onMessage: vi.fn(),
        sendMessage: vi.fn().mockResolvedValue({ valid: true }),
        user: vi.fn().mockResolvedValue({ userId: 'user', username: 'alice' }),
        vaults: vi
            .fn()
            .mockResolvedValue([{ vaultId: 'vault', vaultName: 'Personal' }]),
        entries: vi.fn().mockResolvedValue([
            {
                passwordId: 'password',
                passwordType: 'PASSWORD',
                identifier: 'alice',
                address: 'site.test',
            },
        ]),
        ciphertext: vi.fn().mockResolvedValue({ ciphertext: 'encrypted' }),
        save: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        refresh: vi.fn().mockResolvedValue({
            json: async () => ({ accessToken: 'token' }),
        }),
        logout: vi.fn().mockResolvedValue(undefined),
        token: vi.fn(),
        setting: vi.fn().mockResolvedValue(undefined),
        instanceSetting: vi.fn().mockResolvedValue(undefined),
        loadDeviceId: vi.fn().mockResolvedValue('device'),
        receiver: {
            receiverId: 'receiver',
            vaultId: 'vault',
            code: 'ABC123',
            publicDh: {
                kty: 'OKP' as const,
                crv: 'X25519' as const,
                x: 'public',
            },
            signature: 'signature',
        },
        receivers: vi.fn(),
        identity: vi
            .fn()
            .mockResolvedValue({ kty: 'OKP', crv: 'Ed25519', x: 'identity' }),
        verify: vi.fn().mockResolvedValue(undefined),
        subscribe: vi.fn().mockResolvedValue({ body: 'events' }),
        init: vi.fn().mockResolvedValue({ code: 'ABC123' }),
        keys: vi.fn().mockResolvedValue({
            keys: [
                {
                    code: 'ABC123',
                    vaultId: 'vault',
                    senderId: 'sender',
                    cipherText: 'key',
                },
            ],
        }),
        wait: vi.fn().mockResolvedValue(undefined),
        upload: vi.fn().mockResolvedValue(undefined),
        write: vi.fn().mockResolvedValue(undefined),
        read: vi.fn().mockResolvedValue({ type: 'Password' }),
        selectedVaults: {} as Record<string, string>,
    };
});

vi.mock('../messaging/rpc', () => ({
    messaging: { onMessage: mocks.onMessage, sendMessage: mocks.sendMessage },
}));
vi.mock('mossy-api-client/auth.api', () => ({
    executeUserDetailsRequest: mocks.user,
}));
vi.mock('mossy-api-client/vault.api', () => ({
    executeUserVaultsRequest: mocks.vaults,
}));
vi.mock('mossy-api-client/password.api', () => ({
    executePasswordMetadataRequest: mocks.entries,
    executePasswordCiphertextRequest: mocks.ciphertext,
    executeSavePasswordRequest: mocks.save,
    executeUpdatePasswordRequest: mocks.update,
}));
vi.mock('mossy-api-client/extension/auth.api', () => ({
    executeExtensionRefreshRequest: mocks.refresh,
    executeExtensionLogoutRequest: mocks.logout,
}));
vi.mock('mossy-api-client/tokenStorage', () => ({
    tokenStorage: {
        set: mocks.token,
        get: () => mocks.token.mock.lastCall?.[0] ?? null,
    },
}));
vi.mock('mossy-api-client/deviceTrust.api', () => ({
    executeGetDeviceIdentityKeyRequest: mocks.identity,
}));
vi.mock('mossy-api-client/keySync.api', () => ({
    executeGetPendingReceiversRequest: mocks.receivers,
    executeInitKeySyncRequest: mocks.init,
    executeGetVaultKeysRequest: mocks.keys,
    executeSubscribeReceiverEventsRequest: mocks.subscribe,
    executeUploadVaultKeyRequest: mocks.upload,
}));
vi.mock('../actions/keySync', () => ({ verifyReceiverDetails: mocks.verify }));
vi.mock('../actions/receiverEvents', () => ({
    waitForReceiverResult: mocks.wait,
}));
vi.mock('../storage/wrappedKeys', () => ({
    wrappedKeys: { write: mocks.write, read: mocks.read },
}));
vi.mock('../storage/deviceIdentity', () => ({
    loadDeviceId: mocks.loadDeviceId,
}));
vi.mock('../storage/settings', () => ({
    instanceSetting: {
        getValue: async () => 'https://mossy.test',
        setValue: mocks.instanceSetting,
        watch: vi.fn(),
    },
    themeSetting: { getValue: async () => 'system', setValue: mocks.setting },
    lastIdentifierSetting: { getValue: async () => 'alice' },
    selectedVaultsSetting: {
        getValue: async () => mocks.selectedVaults,
        setValue: async (value: Record<string, string>) => {
            mocks.selectedVaults = value;
        },
    },
}));

const popupSender = {
    id: 'mossy',
    origin: 'chrome-extension://mossy',
    url: 'chrome-extension://mossy/popup.html',
};
const sender = {
    id: 'mossy',
    origin: 'https://site.test',
    tab: { id: 7, url: 'https://site.test/login' },
    frameId: 0,
    documentId: 'document',
    url: 'https://site.test/login',
};
const target = {
    tabId: 7,
    frameId: 0,
    documentId: 'document',
    origin: 'https://site.test',
    formId: 'form',
    passwordId: 'field',
    usernameId: null,
};

function defaultSender(data: unknown) {
    if (data && typeof data === 'object' && 'actionId' in data) {
        return {
            ...popupSender,
            documentId: 'action-document',
            url: `chrome-extension://mossy/action.html#${data.actionId}`,
        };
    }
    return popupSender;
}

// Dispatch the same data/sender shape supplied by @webext-core/messaging.
// Do not reproduce the library's wire envelopes or error serialization here.
async function message<K extends keyof ExtensionProtocol>(
    name: K,
    data: Parameters<ExtensionProtocol[K]>[0],
    messageSender: Omit<chrome.runtime.MessageSender, 'tab'> & {
        tab?: Partial<chrome.tabs.Tab>;
    } = defaultSender(data)
): Promise<ReturnType<ExtensionProtocol[K]>> {
    const registration = mocks.onMessage.mock.calls.find(
        ([type]) => type === name
    );
    expect(registration, `No handler registered for "${name}"`).toBeDefined();
    return registration![1]({ data, sender: messageSender });
}

async function action(
    operation: 'copy-password' | 'fill' | 'save' | 'sync-send' | 'sync-receive',
    data: Partial<Parameters<ExtensionProtocol['handleFill']>[0]> = {}
) {
    const messages = {
        'copy-password': 'handleCopyPassword',
        fill: 'handleFill',
        save: 'handleSave',
        'sync-send': 'handleSyncSend',
        'sync-receive': 'handleSyncReceive',
    } as const;
    await message(messages[operation], {
        vaultId: 'vault',
        passwordId: undefined,
        ...data,
    });
    const url = mocks.chrome.windows.create.mock.lastCall![0].url as string;
    const actionId = new URL(url).hash.slice(1);
    expect(actionId).not.toBe('');
    await message('claimAction', { actionId });
    return { actionId };
}

beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.selectedVaults = {};
    vi.stubGlobal('chrome', mocks.chrome);
    mocks.receivers.mockResolvedValue([mocks.receiver]);
    await import('./background');
    await vi.waitFor(() =>
        expect(mocks.chrome.scripting.registerContentScripts).toHaveBeenCalled()
    );
});

afterEach(async () => {
    // Clear staged capture timers even when a TDD assertion fails midway.
    try {
        await message('handleLogout', undefined);
    } finally {
        vi.unstubAllGlobals();
    }
});

describe('background message transports', () => {
    it('refreshes an access token after startup and retries only the failed API request', async () => {
        const { apiFetch } = await import('mossy-api-client/client');
        mocks.refresh.mockResolvedValueOnce({
            json: async () => ({ accessToken: 'fresh-token' }),
        });
        const fetch = vi
            .fn()
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ message: 'Expired' }), {
                    status: 401,
                })
            )
            .mockResolvedValueOnce(new Response('{}'));
        vi.stubGlobal('fetch', fetch);
        await expect(
            apiFetch('https://mossy.test/api/protected')
        ).resolves.toHaveProperty('status', 200);
        expect(mocks.refresh).toHaveBeenCalledTimes(2);
        expect(mocks.token).toHaveBeenLastCalledWith('fresh-token');
        expect(fetch).toHaveBeenNthCalledWith(
            2,
            'https://mossy.test/api/protected',
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer fresh-token',
                }),
            })
        );
    });

    it('clears an expired token when its refresh session is rejected', async () => {
        const { apiFetch } = await import('mossy-api-client/client');
        mocks.refresh.mockRejectedValueOnce(
            new Error('Refresh session expired')
        );
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(new Response('{}', { status: 401 }))
        );
        await expect(
            apiFetch('https://mossy.test/api/protected')
        ).rejects.toThrow('Refresh session expired');
        expect(mocks.token).toHaveBeenLastCalledWith(null);
        expect(await message('getPopupView', {})).toMatchObject({
            account: null,
        });
    });
    it('rejects every privileged handler when invoked by a content script', async () => {
        for (const [name, handler] of mocks.onMessage.mock.calls) {
            if (name === 'handleDiscover' || name === 'handleCapture') continue;
            await expect(handler({ data: {}, sender })).rejects.toThrow(
                'Untrusted extension page'
            );
        }
        expect(mocks.chrome.windows.create).not.toHaveBeenCalled();
        expect(mocks.ciphertext).not.toHaveBeenCalled();
        expect(mocks.setting).not.toHaveBeenCalled();
    });

    it.each([
        { id: 'other-extension' },
        { origin: 'https://other.test' },
        { url: 'http://site.test/login' },
        { documentId: undefined },
        { tab: { id: 7, url: 'https://other.test' } },
        {
            url: 'https://mossy.test/login',
            origin: 'https://mossy.test',
            tab: { id: 7, url: 'https://mossy.test' },
        },
    ])('rejects captures from an ineligible sender: %j', async (changes) => {
        const capture = {
            password: 'secret',
            identifier: 'alice',
            origin: 'https://site.test',
        };
        await expect(
            message('handleCapture', capture, { ...sender, ...changes })
        ).rejects.toThrow();
        expect(capture.password).toBe('');
        expect(mocks.chrome.action.openPopup).not.toHaveBeenCalled();
    });

    it('rejects malformed, cross-origin and unpermitted content data', async () => {
        const form = {
            formId: 'form',
            passwordId: 'field',
            usernameId: null,
            origin: 'https://other.test',
        };
        await expect(
            message('handleDiscover', { forms: [form] }, sender)
        ).rejects.toThrow('origin');
        await expect(
            message(
                'handleDiscover',
                { forms: Array(31).fill({ ...form, origin: sender.origin }) },
                sender
            )
        ).rejects.toThrow();
        const capture = {
            password: 'secret',
            identifier: 'alice',
            origin: 'https://other.test',
        };
        await expect(message('handleCapture', capture, sender)).rejects.toThrow(
            'origin'
        );
        mocks.chrome.permissions.contains.mockResolvedValueOnce(false);
        await expect(
            message('handleDiscover', { forms: [] }, sender)
        ).rejects.toThrow('disabled');
        expect((await message('getPopupView', {})).targets).toEqual([]);
    });

    it('rediscovers unchanged same-origin forms after the background form map is lost', async () => {
        mocks.chrome.tabs.query.mockResolvedValueOnce([
            { id: 7, url: sender.url },
        ]);
        mocks.chrome.webNavigation.getAllFrames.mockResolvedValueOnce([
            { frameId: 0, url: sender.url },
            { frameId: 1, url: 'https://site.test/frame' },
            { frameId: 2, url: 'https://other.test/frame' },
        ]);
        for (const frameId of [0, 1]) {
            mocks.sendMessage.mockImplementationOnce(async () => {
                await message(
                    'handleDiscover',
                    {
                        forms: [
                            {
                                formId: 'form',
                                passwordId: 'field',
                                usernameId: null,
                                origin: sender.origin,
                            },
                        ],
                    },
                    {
                        ...sender,
                        frameId,
                        documentId: `document-${frameId}`,
                    }
                );
                return { status: 'ok' };
            });
        }
        const view = await message('getPopupView', {});
        expect(view.targets).toHaveLength(2);
        expect(view.targets.map((form) => form.documentId)).toEqual([
            'document-0',
            'document-1',
        ]);
        expect(mocks.sendMessage).toHaveBeenCalledWith(
            'rediscoverForms',
            undefined,
            { tabId: 7, frameId: 0 }
        );
        expect(mocks.sendMessage).toHaveBeenCalledWith(
            'rediscoverForms',
            undefined,
            { tabId: 7, frameId: 1 }
        );
        expect(mocks.sendMessage).not.toHaveBeenCalledWith(
            'rediscoverForms',
            undefined,
            { tabId: 7, frameId: 2 }
        );
    });

    it('binds action claims to the action page and its original document', async () => {
        const request = await action('copy-password', {
            passwordId: 'password',
        });
        await expect(
            message('claimAction', request, popupSender)
        ).rejects.toThrow('Untrusted');
        await expect(
            message('claimAction', request, {
                ...defaultSender(request),
                documentId: 'other-document',
            })
        ).rejects.toThrow('different document');
        await message('finishCopyPassword', request);
        await expect(message('getActionCiphertext', request)).rejects.toThrow(
            'expired'
        );
    });

    it('clears pending captures, tokens and actions when the instance changes', async () => {
        const request = await action('copy-password', {
            passwordId: 'password',
        });
        await message(
            'handleCapture',
            { password: 'secret', identifier: 'alice', origin: sender.origin },
            sender
        );
        await message('handleSettings', {
            instance: 'https://other.test',
            theme: 'system',
        });
        expect(mocks.token).toHaveBeenLastCalledWith(null);
        await expect(message('claimAction', request)).rejects.toThrow(
            'expired'
        );
        expect(await message('getPopupView', {})).toMatchObject({
            instance: 'https://other.test',
            account: null,
            pending: null,
        });
        expect(mocks.chrome.windows.remove).toHaveBeenCalledWith(12);
    });

    it('invalidates actions on logout even if the server cannot be reached', async () => {
        const request = await action('copy-password', {
            passwordId: 'password',
        });
        mocks.logout.mockRejectedValueOnce(new Error('Offline'));
        await expect(message('handleLogout', undefined)).rejects.toThrow(
            'Offline'
        );
        await expect(message('claimAction', request)).rejects.toThrow(
            'expired'
        );
        await expect(action('sync-receive')).rejects.toThrow('Sign in');
        expect(await message('getPopupView', {})).toMatchObject({
            account: null,
            pending: null,
        });
    });

    it('rejects invalid instances at the background boundary', async () => {
        await expect(
            message('handleSettings', {
                instance: 'http://evil.test',
                theme: 'system',
            })
        ).rejects.toThrow('HTTPS');
        expect(mocks.instanceSetting).not.toHaveBeenCalled();
        expect(mocks.logout).not.toHaveBeenCalled();
    });

    it('falls back to an available vault when the selected vault has disappeared', async () => {
        expect(
            await message('getPopupView', { vaultId: 'removed' })
        ).toMatchObject({ selected: 'vault' });
        expect(mocks.entries).toHaveBeenCalledWith(
            'vault',
            'https://mossy.test'
        );
    });

    it('remembers a vault across popup requests without sharing the preference with another account or instance', async () => {
        mocks.vaults.mockResolvedValueOnce([
            { vaultId: 'vault', vaultName: 'Personal' },
            { vaultId: 'work', vaultName: 'Work' },
        ]);
        expect(
            await message('getPopupView', { vaultId: 'work' })
        ).toMatchObject({
            selected: 'work',
            hasVaultKey: true,
        });
        expect(mocks.selectedVaults).toEqual({
            '["https://mossy.test","user"]': 'work',
        });
        mocks.vaults.mockResolvedValueOnce([
            { vaultId: 'vault', vaultName: 'Personal' },
            { vaultId: 'work', vaultName: 'Work' },
        ]);
        expect(await message('getPopupView', {})).toMatchObject({
            selected: 'work',
        });
        mocks.user.mockResolvedValueOnce({
            userId: 'other-user',
            username: 'bob',
        });
        expect(await message('getPopupView', {})).toMatchObject({
            selected: 'vault',
        });
        mocks.selectedVaults = { '["https://other.test","user"]': 'work' };
        expect(await message('getPopupView', {})).toMatchObject({
            selected: 'vault',
        });
    });

    it('reports a missing key for the selected vault before a secret action is started', async () => {
        mocks.read.mockResolvedValueOnce(undefined);
        expect(await message('getPopupView', {})).toMatchObject({
            hasVaultKey: false,
        });
        expect(mocks.read).toHaveBeenCalledWith({
            instance: 'https://mossy.test',
            accountId: 'user',
            vaultId: 'vault',
        });
    });

    it('keeps the account and selector available for an offline vault without requesting its metadata', async () => {
        mocks.vaults.mockResolvedValueOnce([
            { vaultId: 'vault', vaultName: 'Personal', isOnline: false },
        ]);
        expect(await message('getPopupView', {})).toMatchObject({
            account: { userId: 'user' },
            selected: 'vault',
            entries: [],
            vaults: [{ vaultId: 'vault', isOnline: false }],
        });
        expect(mocks.entries).not.toHaveBeenCalled();
    });

    it('keeps vault navigation available when an online vault becomes unreachable, while propagating authentication errors', async () => {
        const { ApiError } = await import('mossy-api-client/client');
        mocks.entries.mockRejectedValueOnce(
            new ApiError('Vault is not connected', 503)
        );
        expect(await message('getPopupView', {})).toMatchObject({
            selected: 'vault',
            entries: [],
            vaultUnavailable: true,
            account: { userId: 'user' },
        });
        mocks.entries.mockRejectedValueOnce(new ApiError('Sign in again', 401));
        await expect(message('getPopupView', {})).rejects.toThrow(
            'Sign in again'
        );
    });

    it('rejects absent entries, captures, device identities and receiving codes with useful errors', async () => {
        await expect(
            action('copy-password', { passwordId: 'removed' })
        ).rejects.toThrow('no longer available');
        await expect(action('save')).rejects.toThrow('Capture is unavailable');
        await expect(action('sync-send', { code: 'EXPIRED' })).rejects.toThrow(
            'receiving code'
        );
        mocks.loadDeviceId.mockResolvedValueOnce(null);
        await expect(action('sync-receive')).rejects.toThrow('Sign in again');
        expect(mocks.chrome.windows.create).not.toHaveBeenCalled();
    });

    it('rejects unknown fill documents and updates for a different login', async () => {
        await expect(
            action('fill', { passwordId: 'password', target })
        ).rejects.toThrow('login form changed');
        await message(
            'handleCapture',
            { password: 'secret', identifier: 'bob', origin: sender.origin },
            sender
        );
        await expect(
            action('save', { passwordId: 'password' })
        ).rejects.toThrow('does not match');
        expect(mocks.chrome.windows.create).not.toHaveBeenCalled();
    });

    it('clears a handed-off capture when its action window fails to open', async () => {
        await message(
            'handleCapture',
            { password: 'secret', identifier: 'alice', origin: sender.origin },
            sender
        );
        mocks.chrome.windows.create.mockRejectedValueOnce(
            new Error('Window unavailable')
        );
        await expect(action('save')).rejects.toThrow('Window unavailable');
        expect(await message('getPopupView', {})).toMatchObject({
            pending: null,
        });
    });

    it('returns vault metadata with its account and instance for UI lookup', async () => {
        expect(await message('getVaults', undefined)).toEqual({
            scope: { instance: 'https://mossy.test', accountId: 'user' },
            vaults: [{ vaultId: 'vault', vaultName: 'Personal' }],
        });
        expect(mocks.vaults).toHaveBeenCalledWith('https://mossy.test');
    });

    it('rejects unavailable vaults before opening an action window', async () => {
        await expect(
            message('handleSyncReceive', {
                vaultId: 'unavailable',
                passwordId: undefined,
            })
        ).rejects.toThrow('This vault is not available to your account.');
        expect(mocks.chrome.windows.create).not.toHaveBeenCalled();
    });

    it('returns settings results directly through the messaging protocol', async () => {
        expect(await message('setTheme', { theme: 'dark' })).toEqual({
            status: 'ok',
        });
        expect(mocks.setting).toHaveBeenCalledWith('dark');
        expect(
            await message('handleSettings', {
                instance: 'https://other.test',
                theme: 'light',
            })
        ).toEqual({ status: 'ok' });
        expect(mocks.logout).toHaveBeenCalledWith('https://mossy.test');
        expect(mocks.instanceSetting).toHaveBeenCalledWith(
            'https://other.test'
        );
        expect(mocks.setting).toHaveBeenCalledWith('light');
        expect(await message('getPopupView', {})).toMatchObject({
            instance: 'https://other.test',
            theme: 'light',
        });
        expect(
            mocks.chrome.runtime.onMessage.addListener
        ).not.toHaveBeenCalled();
        expect(
            mocks.chrome.runtime.onConnect.addListener
        ).not.toHaveBeenCalled();
    });

    it('rejects handler failures so messaging can propagate the error', async () => {
        mocks.setting.mockRejectedValueOnce(new Error('Storage unavailable'));
        await expect(message('setTheme', { theme: 'dark' })).rejects.toThrow(
            'Storage unavailable'
        );
    });

    it('dismisses captured passwords and notifies the popup through messaging', async () => {
        await message(
            'handleCapture',
            {
                password: 'secret',
                identifier: 'alice',
                origin: 'https://site.test',
            },
            sender
        );
        expect(await message('getPopupView', {})).toMatchObject({
            pending: { identifier: 'alice', tabId: 7 },
        });
        mocks.sendMessage.mockClear();

        expect(await message('handleDismiss', undefined)).toEqual({
            status: 'ok',
        });
        expect(await message('getPopupView', {})).toMatchObject({
            pending: null,
        });
        expect(mocks.sendMessage).toHaveBeenCalledWith('onChanged');
        expect(mocks.chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });

    it('discovers forms and fills through messaging with an action ID', async () => {
        expect(
            await message(
                'handleDiscover',
                {
                    forms: [
                        {
                            formId: 'form',
                            passwordId: 'field',
                            usernameId: null,
                            origin: 'https://site.test',
                        },
                    ],
                },
                sender
            )
        ).toEqual({ status: 'ok' });
        expect(await message('getPopupView', {})).toMatchObject({
            targets: [target],
        });
        const request = await action('fill', {
            passwordId: 'password',
            target,
        });
        expect(await message('claimAction', request)).toMatchObject({
            id: request.actionId,
            operation: 'fill',
            deviceId: 'device',
            target,
        });
        expect(await message('getActionCiphertext', request)).toEqual({
            ciphertext: 'encrypted',
        });
        expect(mocks.ciphertext).toHaveBeenCalledWith(
            'password',
            'vault',
            'https://mossy.test'
        );
        expect(
            await message('finishFill', {
                ...request,
                password: 'secret',
            })
        ).toEqual({
            status: 'filled',
        });
        expect(mocks.sendMessage).toHaveBeenCalledWith(
            'fillOnce',
            expect.objectContaining({
                actionId: request.actionId,
                target,
                password: 'secret',
                identifier: 'alice',
            }),
            { tabId: 7, frameId: 0 }
        );
        expect(mocks.chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });

    it.each([false, true])(
        'captures, consumes and saves a password (update: %s)',
        async (update) => {
            const capture = {
                password: 'secret',
                identifier: 'alice',
                origin: 'https://site.test',
            };
            expect(await message('handleCapture', capture, sender)).toEqual({
                status: 'ok',
            });
            expect(capture.password).toBe('');
            const request = await action(
                'save',
                update ? { passwordId: 'password' } : {}
            );
            expect(await message('getActionCandidate', request)).toBe('secret');
            expect(
                await message('finishSave', {
                    ...request,
                    ciphertext: 'encrypted-secret',
                })
            ).toEqual({ status: 'saved' });
            expect(update ? mocks.update : mocks.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    vaultId: 'vault',
                    identifier: 'alice',
                    address: 'https://site.test',
                    cipherText: 'encrypted-secret',
                }),
                'https://mossy.test'
            );
        }
    );

    it('receives a key and stores the converted wrapped-key record', async () => {
        const request = await action('sync-receive');
        expect(
            await message('offerKeySync', {
                ...request,
                receiver: mocks.receiver,
            })
        ).toEqual({
            code: 'ABC123',
        });
        expect(await message('waitForKeySync', request)).toMatchObject({
            transfer: { senderId: 'sender' },
        });
        expect(
            await message('finishKeySyncReceive', {
                ...request,
                value: {
                    type: 'Password',
                    wrappedKey: [1, 2],
                    salt: [3, 4],
                },
            })
        ).toEqual({ status: 'saved' });
        expect(mocks.write).toHaveBeenCalledWith(
            {
                instance: 'https://mossy.test',
                accountId: 'user',
                vaultId: 'vault',
            },
            {
                type: 'Password',
                wrappedKey: new Uint8Array([1, 2]).buffer,
                salt: new Uint8Array([3, 4]),
            }
        );
    });

    it('verifies the receiver and uploads a key using the current sync protocol', async () => {
        const request = await action('sync-send', { code: 'ABC123' });
        expect(mocks.verify).toHaveBeenCalledWith(
            mocks.receiver,
            await mocks.identity()
        );
        const payload = {
            vaultId: 'vault',
            ciphertext: 'encrypted-key',
            publicDh: mocks.receiver.publicDh,
        };
        expect(
            await message('finishKeySyncSend', {
                ...request,
                value: payload,
            })
        ).toEqual({ status: 'sent' });
        expect(mocks.upload).toHaveBeenCalledWith(
            'ABC123',
            payload,
            undefined,
            'https://mossy.test'
        );
    });
});
