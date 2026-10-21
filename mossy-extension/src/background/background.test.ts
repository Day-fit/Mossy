import { beforeEach, describe, expect, it, vi } from 'vitest';

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
        user: vi.fn().mockResolvedValue({ userId: 'user', username: 'alice' }),
        vaults: vi
            .fn()
            .mockResolvedValue([{ vaultId: 'vault', vaultName: 'Personal' }]),
        entries: vi
            .fn()
            .mockResolvedValue([
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
        refresh: vi
            .fn()
            .mockResolvedValue({
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
            publicDh: { kty: 'OKP', crv: 'X25519', x: 'public' },
            signature: 'signature',
        },
        receivers: vi.fn(),
        identity: vi
            .fn()
            .mockResolvedValue({ kty: 'OKP', crv: 'Ed25519', x: 'identity' }),
        verify: vi.fn().mockResolvedValue(undefined),
        subscribe: vi.fn().mockResolvedValue({ body: 'events' }),
        init: vi.fn().mockResolvedValue({ code: 'ABC123' }),
        keys: vi
            .fn()
            .mockResolvedValue({
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
    messaging: { onMessage: mocks.onMessage },
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
    tokenStorage: { set: mocks.token },
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

function popup(kind: string, data = {}) {
    return mocks.onMessage.mock.calls.find(([name]) => name === kind)![1]({
        data,
    });
}

function native<T>(data: object): Promise<T> {
    return new Promise((resolve) => {
        mocks.chrome.runtime.onMessage.addListener.mock.calls[0]![0](
            data,
            sender,
            resolve
        );
    });
}

async function action(operation: string, data = {}) {
    await popup('handleAction', { operation, vaultId: 'vault', ...data });
    const url = mocks.chrome.windows.create.mock.lastCall![0].url as string;
    const port = {
        name: `action:${url.split('#')[1]}`,
        onMessage: { addListener: vi.fn() },
        onDisconnect: { addListener: vi.fn() },
        postMessage: vi.fn(),
    };
    mocks.chrome.runtime.onConnect.addListener.mock.calls[0]![0](port);
    return {
        call<T>(kind: string, value?: unknown): Promise<T> {
            return new Promise((resolve, reject) => {
                port.postMessage.mockImplementationOnce((reply) => {
                    if (reply.error) reject(new Error(reply.error));
                    else resolve(reply.result);
                });
                port.onMessage.addListener.mock.calls[0]![0]({
                    id: 'request',
                    kind,
                    value,
                });
            });
        },
    };
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

describe('background message transports', () => {
    it('keeps native reply envelopes and leaves unrelated messages to their listeners', async () => {
        expect(await native({ kind: 'theme', theme: 'dark' })).toEqual({
            ok: true,
            data: { ok: true },
        });
        expect(mocks.setting).toHaveBeenCalledWith('dark');
        expect(
            await native({
                kind: 'settings',
                instance: 'https://other.test',
                theme: 'light',
            })
        ).toEqual({ ok: true, data: { ok: true } });
        expect(mocks.logout).toHaveBeenCalledWith('https://mossy.test');
        expect(mocks.instanceSetting).toHaveBeenCalledWith('https://other.test');
        expect(mocks.setting).toHaveBeenCalledWith('light');
        expect(await popup('getPopupView')).toMatchObject({
            instance: 'https://other.test',
            theme: 'light',
        });
        expect(
            mocks.chrome.runtime.onMessage.addListener.mock.calls[0]![0](
                { type: 'handleLogout' },
                {},
                vi.fn()
            )
        ).toBeUndefined();
    });

    it('returns native API errors in the existing envelope', async () => {
        mocks.setting.mockRejectedValueOnce(new Error('Storage unavailable'));
        expect(await native({ kind: 'theme', theme: 'dark' })).toEqual({
            ok: false,
            error: 'Storage unavailable',
        });
    });

    it('discovers forms and fills through the existing action port', async () => {
        await native({
            kind: 'discover',
            forms: [
                {
                    formId: 'form',
                    passwordId: 'field',
                    usernameId: null,
                    origin: 'https://site.test',
                },
            ],
        });
        expect(await popup('getPopupView')).toMatchObject({
            targets: [target],
        });
        const port = await action('fill', { passwordId: 'password', target });
        expect(await port.call('claim')).toMatchObject({
            operation: 'fill',
            deviceId: 'device',
            target,
        });
        await native({
            kind: 'settings',
            instance: 'https://other.test',
            theme: 'system',
        });
        expect(await port.call('ciphertext')).toEqual({
            ciphertext: 'encrypted',
        });
        expect(mocks.ciphertext).toHaveBeenCalledWith(
            'password',
            'vault',
            'https://mossy.test'
        );
        expect(await port.call('finish', { password: 'secret' })).toEqual({
            status: 'filled',
        });
        expect(mocks.chrome.tabs.sendMessage).toHaveBeenCalledWith(
            7,
            expect.objectContaining({
                kind: 'fill-once',
                password: 'secret',
                identifier: 'alice',
            }),
            { documentId: 'document' }
        );
    });

    it.each([false, true])(
        'captures, consumes and saves a password (update: %s)',
        async (update) => {
            const capture = {
                kind: 'capture',
                password: 'secret',
                identifier: 'alice',
                origin: 'https://site.test',
            };
            expect(await native(capture)).toEqual({
                ok: true,
                data: { ok: true },
            });
            expect(capture.password).toBe('');
            const port = await action(
                'save',
                update ? { passwordId: 'password' } : {}
            );
            expect(await port.call('candidate')).toBe('secret');
            expect(
                await port.call('finish', { ciphertext: 'encrypted-secret' })
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
        const port = await action('sync-receive');
        expect(await port.call('offer', mocks.receiver)).toEqual({
            code: 'ABC123',
        });
        expect(await port.call('wait')).toMatchObject({
            transfer: { senderId: 'sender' },
        });
        expect(
            await port.call('receive-finish', {
                type: 'Password',
                wrappedKey: [1, 2],
                salt: [3, 4],
            })
        ).toEqual({ status: 'saved' });
        expect(mocks.write).toHaveBeenCalledWith(
            { instance: 'https://mossy.test', account: 'user', vault: 'vault' },
            {
                type: 'Password',
                wrappedKey: new Uint8Array([1, 2]).buffer,
                salt: new Uint8Array([3, 4]),
            }
        );
    });

    it('verifies the receiver and uploads a key using the current sync protocol', async () => {
        const port = await action('sync-send', { code: 'ABC123' });
        expect(mocks.verify).toHaveBeenCalledWith(
            mocks.receiver,
            await mocks.identity()
        );
        const payload = {
            vaultId: 'vault',
            ciphertext: 'encrypted-key',
            publicDh: mocks.receiver.publicDh,
        };
        expect(await port.call('finish', payload)).toEqual({ status: 'sent' });
        expect(mocks.upload).toHaveBeenCalledWith(
            'ABC123',
            payload,
            undefined,
            'https://mossy.test'
        );
    });
});
