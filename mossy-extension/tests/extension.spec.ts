import {
    test,
    expect,
    chromium,
    type BrowserContext,
    type Page,
} from '@playwright/test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import {
    encryptWithKey,
    passwordWrappingKey,
    createReceiverOffer,
    encryptVaultKey,
    decryptVaultKey,
    decryptWithKey,
    unwrapVaultKey,
    type CryptoPair,
    type ReceiverDetails,
    type VaultKeyResponse,
    type UploadVaultKeyRequest,
    type WrappedKeyRecord,
} from '@mossy/client-core';
import sodium from 'libsodium-wrappers-sumo';
const instance = 'https://mossy.dayfit.pl';
const extensionId = 'amkfdcmiegnfjnaidcoaojapakdcchoj';
const vaultPassword = 'correct vault password';
let context: BrowserContext;
let directory: string;
let popup: Page;
let ciphertext: string;
let wrapped: number[];
let rawKey: number[];
const requests: {
    path: string;
    method: string;
    origin?: string;
    body?: Record<string, unknown>;
}[] = [];
let saved: Record<string, unknown> | undefined;
let slowSave = 0;
async function pageRpc<T>(page: Page, command: unknown): Promise<T> {
    return page.evaluate(async (input) => {
        const result = await chrome.runtime.sendMessage(input);
        if (!result?.ok) throw new Error(result?.error ?? 'No response');
        return result.data;
    }, command);
}
async function seed(page: Page) {
    await page.evaluate(
        async ({ instance, wrapped }) => {
            const database = await new Promise<IDBDatabase>(
                (resolve, reject) => {
                    const request = indexedDB.open('mossy-extension-v2', 1);
                    request.onupgradeneeded = () => {
                        if (!request.result.objectStoreNames.contains('device'))
                            request.result.createObjectStore('device');
                        if (
                            !request.result.objectStoreNames.contains('wrapped')
                        )
                            request.result.createObjectStore('wrapped');
                    };
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                }
            );
            const identity = await crypto.subtle.generateKey('Ed25519', false, [
                'sign',
                'verify',
            ]);
            const transaction = database.transaction(
                ['device', 'wrapped'],
                'readwrite'
            );
            transaction
                .objectStore('device')
                .put(identity, ['identity', instance]);
            transaction
                .objectStore('device')
                .put('device-1', ['id', instance, 'alice']);
            transaction.objectStore('wrapped').put(
                {
                    type: 'Password',
                    salt: new Uint8Array(16).fill(7),
                    wrappedKey: new Uint8Array(wrapped).buffer,
                },
                JSON.stringify([instance, 'user-1', 'vault-1'])
            );
            await new Promise<void>((resolve, reject) => {
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            });
            database.close();
        },
        { instance, wrapped }
    );
}
async function openPopup() {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(
        page.getByRole('heading', { name: 'Mossy', exact: true })
    ).toBeVisible();
    return page;
}
async function signIn() {
    await seed(popup);
    await popup.getByLabel('Email or username').fill('alice');
    await popup
        .getByLabel('Account password', { exact: true })
        .fill('account password');
    await popup.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(
        popup.getByRole('heading', { name: 'Passwords', exact: true })
    ).toBeVisible();
}
async function authorize(page: Page) {
    await expect(
        page.getByLabel('Vault password', { exact: true })
    ).toBeVisible();
    await page
        .getByLabel('Vault password', { exact: true })
        .fill(vaultPassword);
    await page
        .getByRole('button', { name: 'Authorize action', exact: true })
        .click();
}
test.beforeAll(async () => {
    const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
    rawKey = Array.from(
        new Uint8Array(await crypto.subtle.exportKey('raw', key))
    );
    const wrapping = await passwordWrappingKey(
        vaultPassword,
        new Uint8Array(16).fill(7)
    );
    wrapped = Array.from(
        new Uint8Array(
            await crypto.subtle.wrapKey('raw', key, wrapping, 'AES-KW')
        )
    );
    ciphertext = await encryptWithKey(
        JSON.stringify({
            kind: 'PASSWORD',
            password: 'fixture-secret-password',
        }),
        key
    );
});
// Playwright requires destructuring the fixture argument even when no fixtures are used.
// eslint-disable-next-line no-empty-pattern
test.beforeEach(async ({}, testInfo) => {
    requests.length = 0;
    saved = undefined;
    slowSave = 0;
    directory = await mkdtemp(join(tmpdir(), 'mossy-v2-browser-'));
    const launch = () =>
        chromium.launchPersistentContext(directory, {
            executablePath: process.env.CHROMIUM_PATH,
            channel: 'chromium',
            headless: true,
            viewport: { width: 440, height: 620 },
            args: [
                `--disable-extensions-except=${resolve('.output/chrome-mv3')}`,
                `--load-extension=${resolve('.output/chrome-mv3')}`,
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--host-resolver-rules=MAP mossy.dayfit.pl ~NOTFOUND',
            ],
        });
    context = await launch();
    if (testInfo.tags.includes('@site')) {
        // Seed a user's prior optional-host approval in this disposable profile.
        // Native extension permission dialogs are outside headless page automation.
        // The production manifest and runtime permission checks remain unchanged.
        const initial = await context.newPage();
        await initial.goto(`chrome-extension://${extensionId}/popup.html`);
        await expect(
            initial.getByRole('heading', { name: 'Mossy', exact: true })
        ).toBeVisible();
        await context.close();
        const preferencesPath = join(directory, 'Default', 'Preferences');
        const preferences = JSON.parse(await readFile(preferencesPath, 'utf8'));
        const extension = preferences.extensions.settings[extensionId];
        for (const name of [
            'active_permissions',
            'granted_permissions',
            'runtime_granted_permissions',
        ]) {
            extension[name] ??= {};
            extension[name].explicit_host = [
                ...new Set([
                    ...(extension[name].explicit_host ?? []),
                    'https://*/*',
                ]),
            ];
        }
        await writeFile(preferencesPath, JSON.stringify(preferences));
        context = await launch();
    }
    await context.route(`${instance}/**`, async (route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        const body = request.postDataJSON();
        requests.push({
            path,
            method: request.method(),
            origin: request.headers()['origin'],
            body,
        });
        let data: unknown = {};
        let status = 200;
        if (path === '/api/v1/auth/extension/refresh') {
            status = 401;
            data = { message: 'Sign in' };
        } else if (path === '/api/v1/device-trust/nonce/device-1')
            data = {
                nonce: 'bm9uY2U',
                challengeId: 'challenge-1',
                expiresAt: new Date(Date.now() + 60000).toISOString(),
            };
        else if (path === '/api/v1/auth/extension/login')
            data = {
                accessToken: 'test-access-token',
                accessTokenType: 'ACCESS_TOKEN',
            };
        else if (path === '/api/v1/auth/user/me')
            data = { userId: 'user-1', username: 'alice' };
        else if (path === '/api/v1/passwords/vault/vaults')
            data = [
                { vaultId: 'vault-1', vaultName: 'Personal', isOnline: true },
                { vaultId: 'vault-2', vaultName: 'Work', isOnline: true },
            ];
        else if (path === '/api/v1/passwords/metadata')
            data = [
                {
                    passwordId: 'password-1',
                    identifier: 'alice',
                    address: 'https://login.example',
                    passwordType: 'PASSWORD',
                    lastModified: '2026-01-01',
                },
            ];
        else if (path.startsWith('/api/v1/passwords/ciphertext/'))
            data = {
                passwordId: 'password-1',
                ciphertext,
                type: 'CIPHERTEXT_RETRIEVAL',
            };
        else if (
            path === '/api/v1/passwords/save' ||
            path === '/api/v1/passwords/update'
        ) {
            saved = body;
            if (slowSave)
                await new Promise((resolve) => setTimeout(resolve, slowSave));
            data = { message: 'Saved' };
        } else if (path === '/api/v1/auth/extension/logout') status = 204;
        else {
            status = 404;
            data = { message: 'Unknown test endpoint' };
        }
        await route.fulfill({
            status,
            contentType: 'application/json',
            body: status === 204 ? '' : JSON.stringify(data),
            headers: {
                'Access-Control-Allow-Origin': `chrome-extension://${extensionId}`,
                'Access-Control-Allow-Credentials': 'true',
            },
        });
    });
    popup = await openPopup();
    await expect(popup.getByLabel('Email or username')).toBeVisible();
    if (testInfo.tags.includes('@site')) {
        const worker =
            context.serviceWorkers()[0] ??
            (await context.waitForEvent('serviceworker'));
        // Exercise the supported badge fallback deterministically. A native
        // toolbar popup can steal focus and dismiss itself in headless mode.
        await worker.evaluate(() => {
            chrome.action.openPopup = async () => {
                throw new Error(
                    'Native toolbar UI unavailable in this headless fixture.'
                );
            };
        });
    }
});
test.afterEach(async () => {
    await context.close();
    await rm(directory, { recursive: true, force: true });
});
test('packaged MV3 has optional site permissions, strict CSP, native keys and independent extension login', async () => {
    const manifest = JSON.parse(
        await readFile('.output/chrome-mv3/manifest.json', 'utf8')
    );
    expect(manifest.minimum_chrome_version).toBe('137');
    expect(manifest.host_permissions).toEqual([`${instance}/*`]);
    expect(manifest.optional_host_permissions).toEqual(['https://*/*']);
    expect(
        await popup.evaluate(() =>
            chrome.permissions.contains({ origins: ['https://*/*'] })
        )
    ).toBe(false);
    expect(manifest.content_security_policy.extension_pages).not.toContain(
        "'unsafe-eval'"
    );
    expect(manifest.web_accessible_resources).toBeUndefined();
    await popup
        .locator('main')
        .screenshot({ path: '/tmp/mossy-v2-signed-out.png' });
    await signIn();
    await popup
        .locator('main')
        .screenshot({ path: '/tmp/mossy-v2-metadata-light.png' });
    await pageRpc(popup, { kind: 'settings', instance, theme: 'dark' });
    await popup.reload();
    await expect(popup.locator('body')).toHaveCSS(
        'background-color',
        'rgb(24, 26, 23)'
    );
    await popup
        .locator('main')
        .screenshot({ path: '/tmp/mossy-v2-metadata-dark.png' });
    expect(
        requests.some(
            (request) =>
                request.path === '/api/v1/auth/login' ||
                request.path === '/api/v1/auth/refresh'
        )
    ).toBe(false);
    const login = requests.find(
        (request) => request.path === '/api/v1/auth/extension/login'
    );
    expect(login?.origin).toBe(`chrome-extension://${extensionId}`);
    expect(
        await popup.evaluate(async () => {
            const db = await new Promise<IDBDatabase>((resolve) => {
                const request = indexedDB.open('mossy-extension-v2');
                request.onsuccess = () => resolve(request.result);
            });
            const pair = await new Promise<CryptoKeyPair>((resolve) => {
                const request = db
                    .transaction('device')
                    .objectStore('device')
                    .get(['identity', 'https://mossy.dayfit.pl']);
                request.onsuccess = () => resolve(request.result);
            });
            return pair.privateKey.extractable;
        })
    ).toBe(false);
});
test('metadata and username copy need no unlock; consecutive password copies each require their own trusted window and worker', async () => {
    await signIn();
    await popup.evaluate(() => {
        Object.defineProperty(navigator, 'clipboard', {
            value: {
                writeText: async (value: string) => {
                    document.documentElement.dataset.copied = value;
                },
            },
            configurable: true,
        });
    });
    await popup.getByRole('button', { name: 'Username', exact: true }).click();
    await expect(popup.locator('html')).toHaveAttribute('data-copied', 'alice');
    expect(
        requests.filter((request) => request.path.includes('/ciphertext/'))
    ).toHaveLength(0);
    await popup.getByRole('searchbox').fill('alice');
    expect(
        requests.filter((request) => request.path.includes('/ciphertext/'))
    ).toHaveLength(0);
    for (let actionNumber = 0; actionNumber < 2; actionNumber++) {
        const windowPromise = context.waitForEvent('page');
        await popup
            .getByRole('button', { name: 'Password', exact: true })
            .click();
        const action = await windowPromise;
        await action.waitForLoadState();
        await action.evaluate(() => {
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText: async () => undefined },
                configurable: true,
            });
        });
        await expect(
            action.getByLabel('Vault password', { exact: true })
        ).toBeVisible();
        expect(
            requests.filter((request) => request.path.includes('/ciphertext/'))
        ).toHaveLength(actionNumber);
        await action
            .locator('main')
            .screenshot({ path: '/tmp/mossy-v2-action.png' });
        await authorize(action);
        await expect.poll(() => action.isClosed()).toBe(true);
        popup = await openPopup();
    }
    expect(
        requests.filter((request) => request.path.includes('/ciphertext/'))
    ).toHaveLength(2);
    expect(
        await popup.evaluate(() => chrome.storage.local.get(null))
    ).not.toHaveProperty('accessToken');
});
test('forged content IPC and stale action windows cannot claim privileged actions', async () => {
    await signIn();
    const unrelated = await context.newPage();
    await unrelated.goto(
        `chrome-extension://${extensionId}/action.html#${crypto.randomUUID()}`
    );
    await expect(unrelated.getByRole('alert')).toContainText('expired');
    await unrelated
        .locator('main')
        .screenshot({ path: '/tmp/mossy-v2-action-error.png' });
    const result = await popup.evaluate(() =>
        chrome.runtime.sendMessage({
            kind: 'fetch',
            url: 'https://evil.example',
        })
    );
    expect(result.ok).toBe(false);
});

async function loginForm(identifier = 'bob', password = 'captured-password') {
    const allowed = await popup.evaluate(() =>
        chrome.permissions.contains({ origins: ['https://*/*'] })
    );
    expect(allowed).toBe(true);
    await context.route('https://login.example/**', (route) =>
        route.fulfill({
            contentType: 'text/html',
            body: '<!doctype html><html><body><form onsubmit="event.preventDefault()"><label>Username<input name="username" autocomplete="username"></label><label>Password<input name="password" type="password" autocomplete="current-password"></label><button type="submit">Log in</button></form><output id="submits">0</output><script>document.querySelector("form").addEventListener("submit",()=>document.querySelector("output").textContent=String(Number(document.querySelector("output").textContent)+1))</script></body></html>',
        })
    );
    const site = await context.newPage();
    await site.goto('https://login.example/login');
    await site.getByLabel('Username').fill(identifier);
    await site.getByLabel('Password').fill(password);
    return site;
}
async function pendingPrompt(site: Page) {
    // Close the test's full-page popup before asking Chrome to open its actual toolbar popup.
    await popup.close();
    await site.getByRole('button', { name: 'Log in', exact: true }).click();
    // Headless Chromium may not expose the native toolbar's popup as a Page.
    // Opening the packaged popup exercises the same badge/fallback entry point.
    popup =
        context.pages().find((page) => page.url().includes('/popup.html')) ??
        (await openPopup());
    await expect(
        popup.getByRole('region', { name: 'Save captured password' })
    ).toBeVisible();
    return popup;
}
test(
    'captured submission appears in the packaged prompt, hands off without extending the deadline, and saves compatible ciphertext',
    { tag: '@site' },
    async () => {
        await signIn();
        const site = await loginForm();
        await pendingPrompt(site);
        const snapshot = await pageRpc<{ pending: { deadline: number } }>(
            popup,
            {
                kind: 'state',
                vaultId: 'vault-1',
            }
        );
        expect(await popup.locator('body').innerText()).not.toContain(
            'captured-password'
        );
        await popup
            .locator('main')
            .screenshot({ path: '/tmp/mossy-v2-capture.png' });
        const windowPromise = context.waitForEvent('page');
        await popup
            .getByRole('button', { name: 'Authorize save', exact: true })
            .click();
        const action = await windowPromise;
        await action.waitForLoadState();
        await expect(action.getByRole('timer')).toBeVisible();
        await action
            .locator('main')
            .screenshot({ path: '/tmp/mossy-v2-save-action.png' });
        await authorize(action);
        await expect.poll(() => saved).toBeTruthy();
        expect(saved).toMatchObject({
            vaultId: 'vault-1',
            identifier: 'bob',
            address: 'https://login.example',
            passwordType: 'PASSWORD',
        });
        expect(Date.now()).toBeLessThan(snapshot.pending.deadline);
        const key = await crypto.subtle.importKey(
            'raw',
            new Uint8Array(rawKey),
            { name: 'AES-GCM' },
            false,
            ['decrypt']
        );
        const blob = Uint8Array.from(atob(String(saved!.cipherText)), (char) =>
            char.charCodeAt(0)
        );
        const plaintext = new TextDecoder().decode(
            await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: blob.slice(0, 12) },
                key,
                blob.slice(12)
            )
        );
        expect(JSON.parse(plaintext)).toEqual({
            kind: 'PASSWORD',
            password: 'captured-password',
        });
        await expect.poll(() => action.isClosed()).toBe(true);
    }
);
test(
    'capture expires exactly during authorization and never dispatches a late save',
    { tag: '@site' },
    async () => {
        await signIn();
        const site = await loginForm();
        await pendingPrompt(site);
        const windowPromise = context.waitForEvent('page');
        await popup
            .getByRole('button', { name: 'Authorize save', exact: true })
            .click();
        const action = await windowPromise;
        await expect(
            action.getByLabel('Vault password', { exact: true })
        ).toBeVisible();
        await expect
            .poll(() => action.isClosed(), { timeout: 12000 })
            .toBe(true);
        expect(saved).toBeUndefined();
        popup = await openPopup();
        const state = await pageRpc<{ pending: unknown }>(popup, {
            kind: 'state',
        });
        expect(state.pending).toBeNull();
    }
);
test(
    'exact-site Fill revalidates the selected document and never submits automatically; unchanged autofill is not captured',
    { tag: '@site' },
    async () => {
        await signIn();
        const site = await loginForm('', '');
        await expect
            .poll(async () => {
                const state = await pageRpc<{ targets: unknown[] }>(popup, {
                    kind: 'state',
                    vaultId: 'vault-1',
                });
                return state.targets.length;
            })
            .toBeGreaterThan(0);
        // Keep the HTTPS site as the active tab while invoking the packaged popup's IPC.
        const state = await pageRpc<{ targets: unknown[] }>(popup, {
            kind: 'state',
            vaultId: 'vault-1',
        });
        const windowPromise = context.waitForEvent('page');
        await pageRpc(popup, {
            kind: 'action',
            operation: 'fill',
            vaultId: 'vault-1',
            passwordId: 'password-1',
            target: state.targets[0],
        });
        const action = await windowPromise;
        await action.waitForLoadState();
        await authorize(action);
        await expect(site.getByLabel('Username')).toHaveValue('alice');
        await expect(site.getByLabel('Password')).toHaveValue(
            'fixture-secret-password'
        );
        await expect(site.locator('#submits')).toHaveText('0');
        await expect.poll(() => action.isClosed()).toBe(true);
        await popup.close();
        await site.getByRole('button', { name: 'Log in', exact: true }).click();
        popup = await openPopup();
        expect(
            (await pageRpc<{ pending: unknown }>(popup, { kind: 'state' }))
                .pending
        ).toBeNull();
    }
);

test(
    'authorized unchanged updates are a no-op and normal redirects preserve the original captured origin',
    { tag: '@site' },
    async () => {
        await signIn();
        const site = await loginForm('alice', 'fixture-secret-password');
        await pendingPrompt(site);
        await site.goto('https://login.example/signed-in');
        await expect(
            popup
                .getByRole('region', { name: 'Save captured password' })
                .getByText('https://login.example', { exact: true })
        ).toBeVisible();
        const actionPromise = context.waitForEvent('page');
        await popup
            .getByRole('button', { name: 'Authorize update', exact: true })
            .click();
        const action = await actionPromise;
        await action.waitForLoadState();
        await authorize(action);
        await expect.poll(() => action.isClosed()).toBe(true);
        expect(saved).toBeUndefined();
        expect(
            requests.filter((request) => request.path.includes('/ciphertext/'))
        ).toHaveLength(1);
    }
);
test(
    'a selected fill aborts after document navigation and leaves the replacement form untouched',
    { tag: '@site' },
    async () => {
        await signIn();
        const site = await loginForm('', '');
        await expect
            .poll(async () => {
                const state = await pageRpc<{ targets: unknown[] }>(popup, {
                    kind: 'state',
                    vaultId: 'vault-1',
                });
                return state.targets.length;
            })
            .toBeGreaterThan(0);
        const state = await pageRpc<{ targets: unknown[] }>(popup, {
            kind: 'state',
        });
        const actionPromise = context.waitForEvent('page');
        await pageRpc(popup, {
            kind: 'action',
            operation: 'fill',
            vaultId: 'vault-1',
            passwordId: 'password-1',
            target: state.targets[0],
        });
        const action = await actionPromise;
        await expect(
            action.getByLabel('Vault password', { exact: true })
        ).toBeVisible();
        await site.goto('https://login.example/new-document');
        await expect.poll(() => action.isClosed()).toBe(true);
        await expect(site.getByLabel('Password')).toHaveValue('');
        expect(
            requests.filter((request) => request.path.includes('/ciphertext/'))
        ).toHaveLength(0);
    }
);

async function webIdentity(): Promise<CryptoPair> {
    await sodium.ready;
    const pair = sodium.crypto_sign_keypair();
    return {
        type: 'Ed25519',
        public: sodium.to_base64(
            pair.publicKey,
            sodium.base64_variants.URLSAFE_NO_PADDING
        ),
        private: sodium.to_base64(
            pair.privateKey,
            sodium.base64_variants.URLSAFE_NO_PADDING
        ),
    };
}
test('a frontend receiver verifies and decrypts an extension key transfer after fresh authorization', async () => {
    await signIn();
    const identity = await webIdentity();
    const offer = await createReceiverOffer('web-device', 'vault-1', identity);
    let upload: UploadVaultKeyRequest | undefined;
    await context.route(`${instance}/api/v1/key-sync/receivers`, (route) =>
        route.fulfill({ json: [{ ...offer.receiver, code: 'ABC123' }] })
    );
    await context.route(
        `${instance}/api/v1/device-trust/device/web-device/identity-key`,
        (route) =>
            route.fulfill({
                json: { kty: 'OKP', crv: 'Ed25519', x: identity.public },
            })
    );
    await context.route(`${instance}/api/v1/key-sync/ABC123`, async (route) => {
        upload = route.request().postDataJSON();
        await route.fulfill({ json: {} });
    });
    const senderIdentity = await popup.evaluate(async () => {
        const database = await new Promise<IDBDatabase>((resolve) => {
            const request = indexedDB.open('mossy-extension-v2');
            request.onsuccess = () => resolve(request.result);
        });
        const pair = await new Promise<CryptoKeyPair>((resolve) => {
            const request = database
                .transaction('device')
                .objectStore('device')
                .get(['identity', 'https://mossy.dayfit.pl']);
            request.onsuccess = () => resolve(request.result);
        });
        return crypto.subtle.exportKey('jwk', pair.publicKey);
    });
    const actionPromise = context.waitForEvent('page');
    await pageRpc(popup, {
        kind: 'action',
        operation: 'sync-send',
        vaultId: 'vault-1',
        code: 'ABC123',
    });
    const action = await actionPromise;
    await authorize(action);
    await expect.poll(() => upload).toBeTruthy();
    const received = await decryptVaultKey(
        {
            code: 'ABC123',
            vaultId: 'vault-1',
            senderId: 'device-1',
            senderPublicDh: upload!.publicDh.x,
            cipherText: upload!.ciphertext,
        },
        { code: 'ABC123', receiver: offer.receiver },
        offer.privateDh,
        { kty: 'OKP', crv: 'Ed25519', x: senderIdentity.x! }
    );
    expect(Array.from(received)).toEqual(rawKey);
    await expect.poll(() => action.isClosed()).toBe(true);
});

test('receiving subscribes before initialization, accepts a frontend signed transfer and protects it before persistence', async () => {
    await signIn();
    const identity = await webIdentity();
    const order: string[] = [];
    let transfer: VaultKeyResponse | undefined;
    await context.route(
        `${instance}/api/v1/key-sync/receiver-events`,
        async (route) => {
            order.push('events');
            await route.fulfill({
                contentType: 'text/event-stream',
                body: `data: ${JSON.stringify({ receiverId: 'device-1', code: 'ABC123', result: 'SUCCESS' })}\n\n`,
            });
        }
    );
    await context.route(`${instance}/api/v1/key-sync`, async (route) => {
        order.push('init');
        const body = route.request().postDataJSON();
        const receiver: ReceiverDetails = { receiverId: 'device-1', ...body };
        const encrypted = await encryptVaultKey(
            new Uint8Array(rawKey),
            { code: 'ABC123', receiver },
            'web-device',
            identity
        );
        transfer = {
            code: 'ABC123',
            vaultId: 'vault-2',
            senderId: 'web-device',
            senderPublicDh: encrypted.publicDh.x,
            cipherText: encrypted.ciphertext,
        };
        await route.fulfill({ json: { code: 'ABC123' } });
    });
    await context.route(
        `${instance}/api/v1/key-sync/vault-keys`,
        async (route) => {
            order.push('keys');
            await route.fulfill({ json: { keys: [transfer] } });
        }
    );
    await context.route(
        `${instance}/api/v1/device-trust/device/web-device/identity-key`,
        (route) =>
            route.fulfill({
                json: { kty: 'OKP', crv: 'Ed25519', x: identity.public },
            })
    );
    const actionPromise = context.waitForEvent('page');
    await pageRpc(popup, {
        kind: 'action',
        operation: 'sync-receive',
        vaultId: 'vault-2',
        protection: 'Password',
    });
    const action = await actionPromise;
    await expect(
        action.getByLabel('Protect with a vault password')
    ).toBeVisible();
    await action
        .locator('main')
        .screenshot({ path: '/tmp/mossy-v2-receive-action.png' });
    expect(order).toEqual(['events', 'init', 'keys']);
    const readWrapped = () =>
        popup.evaluate(async () => {
            const database = await new Promise<IDBDatabase>((resolve) => {
                const request = indexedDB.open('mossy-extension-v2');
                request.onsuccess = () => resolve(request.result);
            });
            return new Promise<
                | { type: string; wrappedKey: number[]; salt: number[] }
                | undefined
            >((resolve) => {
                const request = database
                    .transaction('wrapped')
                    .objectStore('wrapped')
                    .get(
                        JSON.stringify([
                            'https://mossy.dayfit.pl',
                            'user-1',
                            'vault-2',
                        ])
                    );
                request.onsuccess = () =>
                    resolve(
                        request.result
                            ? {
                                  type: request.result.type,
                                  wrappedKey: Array.from(
                                      new Uint8Array(request.result.wrappedKey)
                                  ),
                                  salt: Array.from(request.result.salt),
                              }
                            : undefined
                    );
            });
        });
    expect(await readWrapped()).toBeUndefined();
    await action
        .getByLabel('Protect with a vault password')
        .fill(vaultPassword);
    await action
        .getByRole('button', { name: 'Authorize action', exact: true })
        .click();
    await expect.poll(() => action.isClosed()).toBe(true);
    const stored = await readWrapped();
    expect(stored?.type).toBe('Password');
    const wrapping = await passwordWrappingKey(
        vaultPassword,
        new Uint8Array(stored!.salt)
    );
    const key = await unwrapVaultKey(
        {
            type: 'Password',
            wrappedKey: new Uint8Array(stored!.wrappedKey).buffer,
            salt: new Uint8Array(stored!.salt),
        } satisfies WrappedKeyRecord,
        wrapping
    );
    expect(key.extractable).toBe(false);
    expect(JSON.parse(await decryptWithKey(ciphertext, key)).password).toBe(
        'fixture-secret-password'
    );
});

test(
    'a save dispatched within its deadline completes after expiry without retaining its secret worker',
    { tag: '@site' },
    async () => {
        await signIn();
        const site = await loginForm();
        await pendingPrompt(site);
        const snapshot = await pageRpc<{ pending: { deadline: number } }>(
            popup,
            {
                kind: 'state',
            }
        );
        slowSave = 11000;
        const actionPromise = context.waitForEvent('page');
        await popup
            .getByRole('button', { name: 'Authorize save', exact: true })
            .click();
        const action = await actionPromise;
        await authorize(action);
        await expect.poll(() => saved).toBeTruthy();
        expect(Date.now()).toBeLessThan(snapshot.pending.deadline);
        await expect
            .poll(() => action.isClosed(), { timeout: 15000 })
            .toBe(true);
        expect(Date.now()).toBeGreaterThan(snapshot.pending.deadline);
        expect(
            requests.filter((request) =>
                request.path.endsWith('/passwords/save')
            )
        ).toHaveLength(1);
    }
);

test(
    'closing the source tab cancels its pending authorization and destroys the captured candidate',
    { tag: '@site' },
    async () => {
        await signIn();
        const site = await loginForm();
        await pendingPrompt(site);
        const actionPromise = context.waitForEvent('page');
        await popup
            .getByRole('button', { name: 'Authorize save', exact: true })
            .click();
        const action = await actionPromise;
        await expect(
            action.getByLabel('Vault password', { exact: true })
        ).toBeVisible();
        await site.close();
        await expect.poll(() => action.isClosed()).toBe(true);
        popup = await openPopup();
        expect(
            (await pageRpc<{ pending: unknown }>(popup, { kind: 'state' }))
                .pending
        ).toBeNull();
        expect(saved).toBeUndefined();
    }
);

test(
    'a newer submission replaces the previous authorization without the old window clearing its replacement',
    { tag: '@site' },
    async () => {
        await signIn();
        const site = await loginForm();
        await pendingPrompt(site);
        const old = await pageRpc<{ pending: { id: string } }>(popup, {
            kind: 'state',
        });
        const actionPromise = context.waitForEvent('page');
        await popup
            .getByRole('button', { name: 'Authorize save', exact: true })
            .click();
        const action = await actionPromise;
        await expect(
            action.getByLabel('Vault password', { exact: true })
        ).toBeVisible();
        await site.getByLabel('Username').fill('newer-identifier');
        await site.getByLabel('Password').fill('newer-secret');
        await site.getByRole('button', { name: 'Log in', exact: true }).click();
        await expect.poll(() => action.isClosed()).toBe(true);
        popup = await openPopup();
        await expect(
            popup.getByRole('region', { name: 'Save captured password' })
        ).toContainText('newer-identifier');
        const replacement = await pageRpc<{ pending: { id: string } }>(popup, {
            kind: 'state',
        });
        expect(replacement.pending.id).not.toBe(old.pending.id);
        await pageRpc(popup, { kind: 'dismiss' });
        expect(
            (await pageRpc<{ pending: unknown }>(popup, { kind: 'state' }))
                .pending
        ).toBeNull();
        expect(saved).toBeUndefined();
    }
);

test('frontend themes, search recovery, settings and key-sync controls stay usable in the compact popup', async () => {
    await signIn();
    await popup.emulateMedia({ reducedMotion: 'reduce' });
    for (const theme of ['light', 'dark'] as const) {
        await pageRpc(popup, { kind: 'settings', instance, theme });
        await popup.reload();
        await expect(
            popup.getByRole('heading', { name: 'Passwords', exact: true })
        ).toBeVisible();
        await expect(popup.locator('body')).toHaveCSS(
            'font-family',
            'Syne, sans-serif'
        );
        await expect(
            popup.getByRole('heading', { name: 'Passwords', exact: true })
        ).toHaveCSS('font-family', /^Geologica,/);
        await popup.getByRole('searchbox').fill('no-such-login');
        await expect(
            popup.getByRole('heading', { name: 'No matching passwords' })
        ).toBeVisible();
        await expect(popup.locator('.entry')).toHaveCount(0);
        await popup
            .locator('main')
            .screenshot({ path: `/tmp/mossy-v2-empty-${theme}.png` });
        await popup.getByRole('searchbox').fill('  ALICE  ');
        await expect(popup.locator('.entry')).toHaveCount(1);
        await popup
            .getByRole('button', { name: 'Sync vault keys', exact: true })
            .click();
        await expect(
            popup.getByRole('heading', {
                name: 'Sync a vault key',
                exact: true,
            })
        ).toBeFocused();
        await expect(
            popup.getByRole('button', {
                name: 'Receive · passkey',
                exact: true,
            })
        ).toBeEnabled();
        await expect(
            popup.getByRole('button', {
                name: 'Receive · password',
                exact: true,
            })
        ).toBeEnabled();
        await popup
            .locator('main')
            .screenshot({ path: `/tmp/mossy-v2-sync-${theme}.png` });
        await popup
            .getByRole('button', { name: 'Settings', exact: true })
            .click();
        await expect(
            popup.getByRole('heading', { name: 'Settings', exact: true })
        ).toBeFocused();
        await expect(popup.getByLabel('Mossy instance')).toHaveValue(instance);
        await expect(popup.getByLabel('Appearance')).toHaveValue(theme);
        await popup
            .locator('main')
            .screenshot({ path: `/tmp/mossy-v2-settings-${theme}.png` });
        await popup
            .getByRole('button', { name: 'Close settings', exact: true })
            .click();
    }
    await popup.getByRole('button', { name: 'Settings', exact: true }).click();
    await popup.getByLabel('Appearance').selectOption('system');
    await popup
        .getByRole('button', { name: 'Save settings', exact: true })
        .click();
    await expect(
        popup.getByRole('heading', { name: 'Passwords', exact: true })
    ).toBeVisible();
    await popup.reload();
    for (const colorScheme of ['light', 'dark'] as const) {
        await popup.emulateMedia({ colorScheme });
        await expect(popup.locator('body')).toHaveCSS(
            'background-color',
            colorScheme === 'dark' ? 'rgb(24, 26, 23)' : 'rgb(246, 246, 246)'
        );
    }
    // Long metadata and many records must scroll vertically inside the list.
    await context.route(`${instance}/api/v1/passwords/metadata*`, (route) =>
        route.fulfill({
            json: Array.from({ length: 12 }, (_, index) => ({
                passwordId: `long-${index}`,
                identifier:
                    'a-long-username-without-spaces@example.example.example',
                address:
                    'https://a-long-domain.example/long/path/without/spaces/for-a-saved-login',
                passwordType: 'PASSWORD',
                lastModified: '2026-01-01',
            })),
        })
    );
    await popup.setViewportSize({ width: 320, height: 600 });
    await popup.reload();
    await expect(popup.locator('.entry')).toHaveCount(12);
    expect(
        await popup.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth
        )
    ).toBe(true);
    expect(
        await popup
            .locator('.scroll')
            .evaluate((element) => element.scrollHeight > element.clientHeight)
    ).toBe(true);
    await popup
        .locator('main')
        .screenshot({ path: '/tmp/mossy-v2-narrow.png' });
    await context.route(`${instance}/api/v1/passwords/metadata*`, (route) =>
        route.fulfill({ json: [] })
    );
    await popup.reload();
    await expect(
        popup.getByRole('heading', { name: 'No passwords yet' })
    ).toBeVisible();
    await context.route(`${instance}/api/v1/passwords/vault/vaults`, (route) =>
        route.fulfill({ json: [] })
    );
    await popup.reload();
    await expect(
        popup.getByRole('link', { name: 'Create a vault in Mossy' })
    ).toBeVisible();
    await context.route(`${instance}/api/v1/passwords/vault/vaults`, (route) =>
        route.fulfill({
            status: 503,
            json: { message: 'Vault service unavailable' },
        })
    );
    await popup.reload();
    await expect(popup.getByRole('alert')).toBeVisible();
    await expect(
        popup.getByRole('button', { name: 'Dismiss error' })
    ).toHaveCount(0);
    await context.route(`${instance}/api/v1/passwords/vault/vaults`, (route) =>
        route.fulfill({ json: [] })
    );
    await popup.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(
        popup.getByRole('link', { name: 'Create a vault in Mossy' })
    ).toBeVisible();
    await expect(popup.getByRole('alert')).toHaveCount(0);
});
