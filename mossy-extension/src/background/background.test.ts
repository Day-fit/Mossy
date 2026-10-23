import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtensionProtocol } from '../messaging/rpc';

const mocks = vi.hoisted(() => {
    const event = () => ({ addListener: vi.fn() });
    return {
        chrome: {
            runtime: {
                onMessage: event(),
                onConnect: event(),
                sendMessage: vi.fn().mockResolvedValue(undefined),
                getURL: (path: string) => `chrome-extension://mossy${path}`,
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
            windows: { create: vi.fn().mockResolvedValue(undefined) },
            webNavigation: { onCommitted: event() },
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
    wrappedKeys: { write: mocks.write },
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
}));

const sender = {
    tab: { id: 7 },
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

// Dispatch the same data/sender shape supplied by @webext-core/messaging.
// Do not reproduce the library's wire envelopes or error serialization here.
async function message<K extends keyof ExtensionProtocol>(
    name: K,
    data: Parameters<ExtensionProtocol[K]>[0],
    messageSender: Omit<chrome.runtime.MessageSender, 'tab'> & {
        tab?: Partial<chrome.tabs.Tab>;
    } = {}
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
    return { actionId };
}

beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
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
        await message('handleDismiss', undefined);
    } finally {
        vi.unstubAllGlobals();
    }
});

describe('background message transports', () => {
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
        await message('handleSettings', {
            instance: 'https://other.test',
            theme: 'system',
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
            { instance: 'https://mossy.test', accountId: 'user', vaultId: 'vault' },
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
