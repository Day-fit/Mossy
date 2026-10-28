import type { NativeIdentity } from '../src/storage/deviceIdentity';
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
    importWrappingKey,
    passwordWrappingKey,
    decryptWithKey,
    unwrapVaultKey,
} from '../src/security/vaultCrypto';
import {
    createReceiverOffer,
    encryptVaultKey,
    decryptVaultKey,
} from '../src/actions/keySync';
import {
    type ReceiverDetails,
    type VaultKeyResponse,
    type UploadVaultKeyRequest,
} from 'mossy-api-client';
import { type WrappedKeyRecord } from '../src/types/vault';

const instance = 'https://mossy.dayfit.pl';
const extensionId = 'amkfdcmiegnfjnaidcoaojapakdcchoj';
const extensionDirectory = resolve(
    process.env.MOSSY_TEST_EXTENSION ?? '.output/chrome-mv3'
);
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
        const { type, ...data } = input as { type: string };
        const result = await chrome.runtime.sendMessage({
            id: 1,
            type,
            data,
            timestamp: Date.now(),
        });
        if (result?.err) throw new Error(result.err.message);
        if (!result) throw new Error('No response');
        return result.res;
    }, command);
}

async function seed(page: Page) {
    await page.evaluate(
        async ({ instance, wrapped }) => {
            const database = await new Promise<IDBDatabase>(
                (resolve, reject) => {
                    const request = indexedDB.open('mossy-extension-v2', 1);
                    request.onupgradeneeded = () => {
                        const needsDeviceStore =
                            !request.result.objectStoreNames.contains('device');
                        if (needsDeviceStore) {
                            request.result.createObjectStore('device');
                        }

                        const needsWrappedKeyStore =
                            !request.result.objectStoreNames.contains(
                                'wrapped'
                            );
                        if (needsWrappedKeyStore) {
                            request.result.createObjectStore('wrapped');
                        }
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
                JSON.stringify([
                    instance,
                    'user-1',
                    '10000000-0000-4000-8000-000000000001',
                ])
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

async function uiSnapshot(page: Page, name: string) {
    await expect
        .poll(() =>
            page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth
            )
        )
        .toBe(true);
    await page.locator('main').screenshot({
        path: `/tmp/mossy-extension-ui/${name}.png`,
        animations: 'disabled',
    });
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

async function completeAndClose(page: Page) {
    await expect(
        page.getByRole('button', { name: 'Close', exact: true })
    ).toBeVisible();
    await expect.poll(() => page.workers().length).toBe(0);
    await uiSnapshot(
        page,
        `success-${(await page.locator('#action-title').innerText()).toLowerCase().replaceAll(' ', '-')}`
    );
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect.poll(() => page.isClosed()).toBe(true);
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
            viewport: { width: 520, height: 620 },
            args: [
                `--disable-extensions-except=${extensionDirectory}`,
                `--load-extension=${extensionDirectory}`,
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--host-resolver-rules=MAP mossy.dayfit.pl ~NOTFOUND',
            ],
        });

    context = await launch();

    const shouldSeedWebsiteAccess = testInfo.tags.includes('@site');
    if (shouldSeedWebsiteAccess) {
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
                    'http://*/*',
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
        const isPasswordWrite =
            path === '/api/v1/passwords/save' ||
            path === '/api/v1/passwords/update';
        const isCiphertextRequest = path.startsWith(
            '/api/v1/passwords/ciphertext/'
        );

        if (path === '/api/v1/auth/extension/refresh') {
            status = 401;
            data = { message: 'Sign in' };
        } else if (path === '/api/v1/device-trust/nonce/device-1') {
            data = {
                nonce: 'bm9uY2U',
                challengeId: 'challenge-1',
                expiresAt: new Date(Date.now() + 60000).toISOString(),
            };
        } else if (path === '/api/v1/auth/extension/login') {
            data = {
                accessToken: 'test-access-token',
                accessTokenType: 'ACCESS_TOKEN',
            };
        } else if (path === '/api/v1/auth/user/me') {
            data = { userId: 'user-1', username: 'alice' };
        } else if (path === '/api/v1/passwords/vault/vaults') {
            data = [
                {
                    vaultId: '10000000-0000-4000-8000-000000000001',
                    vaultName: 'Personal',
                    isOnline: true,
                },
                {
                    vaultId: '10000000-0000-4000-8000-000000000002',
                    vaultName: 'Work',
                    isOnline: true,
                },
            ];
        } else if (path === '/api/v1/passwords/metadata') {
            data = [
                {
                    passwordId: '20000000-0000-4000-8000-000000000001',
                    identifier: 'alice',
                    address: 'https://login.example',
                    passwordType: 'PASSWORD',
                    lastModified: '2026-01-01',
                },
            ];
        } else if (isCiphertextRequest) {
            data = {
                passwordId: '20000000-0000-4000-8000-000000000001',
                ciphertext,
                type: 'CIPHERTEXT_RETRIEVAL',
            };
        } else if (isPasswordWrite) {
            saved = body;

            if (slowSave) {
                await new Promise((resolve) => setTimeout(resolve, slowSave));
            }

            data = { message: 'Saved' };
        } else if (path === '/api/v1/auth/extension/logout') {
            status = 204;
        } else {
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

    const requiresWebsiteAccess = testInfo.tags.includes('@site');
    if (requiresWebsiteAccess) {
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

test(
    'unchanged forms are rediscovered after the background worker is stopped',
    { tag: '@site' },
    async () => {
        await signIn();
        const site = await loginForm();
        await site.bringToFront();
        const view = () =>
            pageRpc<{ targets: unknown[] }>(popup, { type: 'getPopupView' });
        await expect.poll(async () => (await view()).targets.length).toBe(1);
        const before = await view();
        await context.route(
            `${instance}/api/v1/auth/extension/refresh`,
            (route) =>
                route.fulfill({
                    json: { accessToken: 'restored-access-token' },
                })
        );

        const session = await context.newCDPSession(site);
        const versionId = new Promise<string>((resolve) => {
            session.on('ServiceWorker.workerVersionUpdated', ({ versions }) => {
                const version = versions.find(
                    (item) =>
                        item.scriptURL.startsWith(
                            `chrome-extension://${extensionId}/`
                        ) && item.runningStatus === 'running'
                );
                if (version) resolve(version.versionId);
            });
        });
        await session.send('ServiceWorker.enable');
        await session.send('ServiceWorker.stopWorker', {
            versionId: await versionId,
        });
        await session.detach();

        // The page and its content script stay untouched while the worker loses its map.
        const after = await view();
        expect(after.targets).toEqual(before.targets);
        expect(
            requests.filter(
                (request) => request.path === '/api/v1/auth/user/me'
            ).length
        ).toBeGreaterThan(1);
    }
);

test('a live authorization keeps its worker active past the idle timeout and still completes', async () => {
    await signIn();
    const worker =
        context.serviceWorkers()[0] ??
        (await context.waitForEvent('serviceworker'));
    await worker.evaluate(() => {
        const original = chrome.runtime.getPlatformInfo.bind(chrome.runtime);
        let calls = 0;
        chrome.runtime.getPlatformInfo = (() => {
            calls++;
            return original();
        }) as typeof chrome.runtime.getPlatformInfo;
        Object.defineProperty(globalThis, '__actionHeartbeatCalls', {
            get: () => calls,
        });
    });
    const opened = context.waitForEvent('page');
    await popup.getByRole('button', { name: 'Password', exact: true }).click();
    const action = await opened;
    await expect(
        action.getByLabel('Vault password', { exact: true })
    ).toBeVisible();
    await action.evaluate(() => {
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: async () => undefined },
            configurable: true,
        });
    });
    await action.waitForTimeout(35_000);
    expect(
        await worker.evaluate(() =>
            Reflect.get(globalThis, '__actionHeartbeatCalls')
        )
    ).toBeGreaterThan(0);
    await authorize(action);
    await completeAndClose(action);
});

test('parallel popup requests recover from expired access tokens with one refresh', async () => {
    await signIn();
    let expiredRequests = 0;
    let refreshes = 0;
    let bothExpired!: () => void;
    const expired = new Promise<void>((resolve) => {
        bothExpired = resolve;
    });
    for (const path of [
        '/api/v1/auth/user/me',
        '/api/v1/passwords/vault/vaults',
    ]) {
        await context.route(`${instance}${path}`, async (route) => {
            if (
                route.request().headers().authorization !==
                'Bearer test-access-token'
            ) {
                await route.fallback();
                return;
            }
            if (++expiredRequests === 2) bothExpired();
            await route.fulfill({
                status: 401,
                json: { message: 'Access token expired' },
            });
        });
    }
    await context.route(
        `${instance}/api/v1/auth/extension/refresh`,
        async (route) => {
            refreshes++;
            await expired;
            await route.fulfill({
                json: { accessToken: 'renewed-access-token' },
            });
        }
    );
    await popup.reload();
    await expect(
        popup.getByRole('heading', { name: 'Passwords', exact: true })
    ).toBeVisible();
    await expect(
        popup.getByText('alice', { exact: true }).last()
    ).toBeVisible();
    expect(expiredRequests).toBe(2);
    expect(refreshes).toBe(1);
});

test('packaged MV3 has optional site permissions, strict CSP, native keys and independent extension login', async () => {
    const manifest = JSON.parse(
        await readFile('.output/chrome-mv3/manifest.json', 'utf8')
    );

    expect(manifest.minimum_chrome_version).toBe('137');
    expect(manifest.host_permissions).toEqual([`${instance}/*`]);
    expect(manifest.optional_host_permissions).toEqual([
        'http://*/*',
        'https://*/*',
    ]);
    expect(
        await popup.evaluate(() =>
            chrome.permissions.contains({
                origins: ['http://*/*', 'https://*/*'],
            })
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
    await pageRpc(popup, { type: 'handleSettings', instance, theme: 'dark' });
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
    await expect(popup.getByRole('status')).toContainText(
        'Username copied to clipboard.'
    );
    await uiSnapshot(popup, 'username-copied');

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
        await completeAndClose(action);
        popup = await openPopup();
    }

    expect(
        requests.filter((request) => request.path.includes('/ciphertext/'))
    ).toHaveLength(2);
    expect(
        await popup.evaluate(() => chrome.storage.local.get(null))
    ).not.toHaveProperty('accessToken');
});

test(
    'forged content IPC and stale action windows cannot claim privileged actions',
    { tag: '@site' },
    async () => {
        await signIn();

        const unrelated = await context.newPage();

        await unrelated.goto(
            `chrome-extension://${extensionId}/action.html#${crypto.randomUUID()}`
        );
        await expect(unrelated.getByRole('alert')).toContainText('expired');
        await unrelated
            .locator('main')
            .screenshot({ path: '/tmp/mossy-v2-action-error.png' });

        await loginForm();
        const responses = await popup.evaluate(async () => {
            const [tab] = await chrome.tabs.query({
                url: 'https://login.example/*',
            });
            if (tab?.id === undefined)
                throw new Error('Missing login fixture tab');
            const injections = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: async () => {
                    const responses = [];
                    for (const type of [
                        'getPopupView',
                        'handleSyncReceive',
                        'handleLogout',
                    ]) {
                        responses.push(
                            await chrome.runtime.sendMessage({
                                id: 1,
                                type,
                                timestamp: Date.now(),
                                data: {
                                    vaultId:
                                        '10000000-0000-4000-8000-000000000001',
                                },
                            })
                        );
                    }
                    return responses;
                },
            });
            return injections[0]?.result;
        });
        expect(responses).toHaveLength(3);
        for (const response of responses!) {
            expect(response.err?.message).toContain('Untrusted extension page');
        }
        await expect(
            popup.getByRole('heading', { name: 'Passwords', exact: true })
        ).toBeVisible();
    }
);

async function loginForm(
    identifier = 'bob',
    password = 'captured-password',
    protocol = 'https:'
) {
    const allowed = await popup.evaluate(() =>
        chrome.permissions.contains({ origins: ['http://*/*', 'https://*/*'] })
    );

    expect(allowed).toBe(true);

    await context.route(`${protocol}//login.example/**`, (route) =>
        route.fulfill({
            contentType: 'text/html',
            body: '<!doctype html><html lang="en"><body><form onsubmit="event.preventDefault()"><label>Username<input name="username" autocomplete="username"></label><label>Password<input name="password" type="password" autocomplete="current-password"></label><button type="submit">Log in</button></form><output id="submits">0</output><script>document.querySelector("form").addEventListener("submit",()=>document.querySelector("output").textContent=String(Number(document.querySelector("output").textContent)+1))</script></body></html>',
        })
    );

    const site = await context.newPage();

    await site.goto(`${protocol}//login.example/login`);
    await site.getByLabel('Username').fill(identifier);
    await site.getByLabel('Password').fill(password);
    await site.getByLabel('Password').press('Escape');

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
                type: 'getPopupView',
                vaultId: '10000000-0000-4000-8000-000000000001',
            }
        );

        expect(await popup.locator('body').innerText()).not.toContain(
            'captured-password'
        );

        await popup
            .locator('main')
            .screenshot({ path: '/tmp/mossy-v2-capture.png' });
        for (const theme of ['light', 'dark'] as const) {
            await pageRpc(popup, { type: 'setTheme', theme });
            await expect(popup.locator('html')).toHaveAttribute(
                'data-theme',
                theme
            );
            await uiSnapshot(popup, `capture-${theme}`);
        }

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
        await uiSnapshot(action, 'authorize-save-dark');
        await authorize(action);
        await expect.poll(() => saved).toBeTruthy();

        expect(saved).toMatchObject({
            vaultId: '10000000-0000-4000-8000-000000000001',
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

        await completeAndClose(action);
    }
);

test(
    'a missing vault key leaves the save error visible and releases the captured password',
    { tag: '@site' },
    async () => {
        await signIn();
        await popup.evaluate(async () => {
            const database = await new Promise<IDBDatabase>(
                (resolve, reject) => {
                    const request = indexedDB.open('mossy-extension-v2');
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                }
            );
            const transaction = database.transaction('wrapped', 'readwrite');
            transaction.objectStore('wrapped').clear();
            await new Promise<void>((resolve, reject) => {
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            });
            database.close();
        });

        const site = await loginForm();
        await pendingPrompt(site);
        const opened = context.waitForEvent('page');
        await expect(
            popup.getByRole('button', {
                name: 'Receive vault key',
                exact: true,
            })
        ).toBeVisible();
        await expect(
            popup.getByText(
                'Receive the vault key first, then submit this login again to save it.'
            )
        ).toBeVisible();
        // The action boundary must also retain a useful error if invoked without a key.
        await uiSnapshot(popup, 'capture-missing-key');
        await pageRpc(popup, {
            type: 'handleSave',
            vaultId: '10000000-0000-4000-8000-000000000001',
        });
        const action = await opened;

        await expect(action.getByRole('alert')).toContainText(
            'This browser needs the vault key.'
        );
        await expect(action.getByRole('alert')).toContainText(
            'Sync vault keys'
        );
        await expect.poll(() => action.workers().length).toBe(0);
        expect(saved).toBeUndefined();
        await expect(
            pageRpc(action, {
                type: 'claimAction',
                actionId: new URL(action.url()).hash.slice(1),
            })
        ).rejects.toThrow('expired');
        popup = await openPopup();
        const view = await pageRpc<{ pending: unknown }>(popup, {
            type: 'getPopupView',
        });
        expect(view.pending).toBeNull();
        for (const theme of ['light', 'dark'] as const) {
            await pageRpc(popup, { type: 'setTheme', theme });
            await expect(action.locator('html')).toHaveAttribute(
                'data-theme',
                theme
            );
            await uiSnapshot(action, `missing-key-error-${theme}`);
        }
        await action
            .getByRole('button', { name: 'Close', exact: true })
            .click();
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
            type: 'getPopupView',
        });

        expect(state.pending).toBeNull();
    }
);

for (const protocol of ['http:', 'https:']) {
    test(
        `new-password suggestions share capture on ${protocol} without filling current passwords`,
        { tag: '@site' },
        async () => {
            await signIn();
            const site = await loginForm('alice', 'current-secret', protocol);
            await site.evaluate(() => {
                document.querySelector('form')!.insertAdjacentHTML(
                    'beforeend',
                    `
                <label>New password<input name="new" type="password" autocomplete="new-password"></label>
                <label>Confirm password<input name="confirm" type="password" autocomplete="new-password"></label>
            `
                );
            });
            const suggestions = site.locator('mossy-fill-suggestions');
            await site.getByLabel('New password', { exact: true }).click();
            await expect(suggestions).toBeVisible();
            await suggestions.screenshot({
                path: `/tmp/mossy-generation-${protocol.slice(0, -1)}.png`,
            });
            await site
                .getByLabel('New password', { exact: true })
                .press('ArrowDown');
            await site.keyboard.press('Enter');
            await expect(suggestions).toHaveCount(0);
            const generated = await site
                .getByLabel('New password', { exact: true })
                .inputValue();
            expect(generated).toMatch(/^[1-9A-HJ-NP-Za-km-z]{24}$/);
            await expect(site.getByLabel('Confirm password')).toHaveValue(
                generated
            );
            await expect(
                site.getByLabel('Password', { exact: true })
            ).toHaveValue('current-secret');
            await expect(site.locator('#submits')).toHaveText('0');
            expect(
                requests.filter((request) =>
                    request.path.includes('/ciphertext/')
                )
            ).toHaveLength(0);
            await site.getByLabel('Confirm password').fill('mismatch');
            await site
                .getByRole('button', { name: 'Log in', exact: true })
                .click();
            expect(
                await pageRpc<{ pending: unknown }>(popup, {
                    type: 'getPopupView',
                })
            ).toMatchObject({ pending: null });
            await site.getByLabel('Confirm password').fill(generated);
            await pendingPrompt(site);
            expect(
                await pageRpc<{ pending: { origin: string } }>(popup, {
                    type: 'getPopupView',
                })
            ).toMatchObject({
                pending: {
                    origin: `${protocol}//login.example`,
                    identifier: 'alice',
                },
            });
        }
    );
}

test(
    'inline login suggestions authorize filling and support keyboard dismissal',
    { tag: '@site' },
    async () => {
        await signIn();
        const site = await loginForm('', '');
        const suggestions = site.locator('mossy-fill-suggestions');
        await site.getByLabel('Username').click();
        await expect(suggestions).toBeVisible();
        // The page can see the host, but cannot inspect saved login metadata.
        expect(
            await suggestions.evaluate((host) => host.shadowRoot)
        ).toBeNull();
        await expect(site.getByLabel('Password')).toHaveValue('');
        expect(
            requests.filter((request) => request.path.includes('/ciphertext/'))
        ).toHaveLength(0);
        await site.getByLabel('Username').press('Escape');
        await expect(suggestions).toHaveCount(0);
        await site.getByLabel('Password').click();
        await expect(suggestions).toBeVisible();
        await suggestions.screenshot({
            path: '/tmp/mossy-fill-suggestions.png',
        });
        await site.getByLabel('Password').press('ArrowDown');
        const windowPromise = context.waitForEvent('page');
        await site.keyboard.press('Enter');
        const action = await windowPromise;
        await authorize(action);
        await expect(site.getByLabel('Username')).toHaveValue('alice');
        await expect(site.getByLabel('Password')).toHaveValue(
            'fixture-secret-password'
        );
        await expect(site.locator('#submits')).toHaveText('0');
        await completeAndClose(action);
        await expect(suggestions).toHaveCount(0);

        await site.getByLabel('Username').click();
        await expect(suggestions).toBeVisible();
        await site.mouse.click(500, 400);
        await expect(suggestions).toHaveCount(0);
        await site
            .getByLabel('Password')
            .evaluate(
                (input) =>
                    ((input as HTMLInputElement).autocomplete = 'new-password')
            );
        await site.getByLabel('Password').click();
        await expect(suggestions).toBeVisible();
        await site.getByLabel('Password').press('Escape');
        await expect(suggestions).toHaveCount(0);
    }
);

test(
    'inline suggestions support mouse selection and the saved appearance',
    { tag: '@site' },
    async () => {
        await signIn();
        await pageRpc(popup, { type: 'setTheme', theme: 'dark' });
        const site = await loginForm('', '');
        await site.getByLabel('Username').click();
        const suggestions = site.locator('mossy-fill-suggestions');
        await expect(suggestions).toBeVisible();
        await suggestions.screenshot({
            path: '/tmp/mossy-fill-suggestions-dark.png',
        });
        const box = (await suggestions.boundingBox())!;
        const actionPromise = context.waitForEvent('page');
        await site.mouse.click(box.x + 24, box.y + 56);
        const action = await actionPromise;
        await expect(
            action.getByLabel('Vault password', { exact: true })
        ).toBeVisible();
        await action
            .getByRole('button', { name: 'Cancel', exact: true })
            .click();
        await expect.poll(() => action.isClosed()).toBe(true);
        await expect(site.getByLabel('Password')).toHaveValue('');
        await expect(site.locator('#submits')).toHaveText('0');
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
                    type: 'getPopupView',
                    vaultId: '10000000-0000-4000-8000-000000000001',
                });

                return state.targets.length;
            })
            .toBeGreaterThan(0);

        // Keep the HTTPS site as the active tab while invoking the packaged popup's IPC.
        const state = await pageRpc<{ targets: unknown[] }>(popup, {
            type: 'getPopupView',
            vaultId: '10000000-0000-4000-8000-000000000001',
        });
        const windowPromise = context.waitForEvent('page');

        await pageRpc(popup, {
            type: 'handleFill',
            vaultId: '10000000-0000-4000-8000-000000000001',
            passwordId: '20000000-0000-4000-8000-000000000001',
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
        await completeAndClose(action);
        await popup.close();
        await site.getByRole('button', { name: 'Log in', exact: true }).click();
        popup = await openPopup();

        expect(
            (
                await pageRpc<{ pending: unknown }>(popup, {
                    type: 'getPopupView',
                })
            ).pending
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
        await completeAndClose(action);

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
                    type: 'getPopupView',
                    vaultId: '10000000-0000-4000-8000-000000000001',
                });

                return state.targets.length;
            })
            .toBeGreaterThan(0);

        const state = await pageRpc<{ targets: unknown[] }>(popup, {
            type: 'getPopupView',
        });
        const actionPromise = context.waitForEvent('page');

        await pageRpc(popup, {
            type: 'handleFill',
            vaultId: '10000000-0000-4000-8000-000000000001',
            passwordId: '20000000-0000-4000-8000-000000000001',
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

async function peerIdentity(): Promise<NativeIdentity> {
    const pair = (await crypto.subtle.generateKey('Ed25519', false, [
        'sign',
        'verify',
    ])) as CryptoKeyPair;
    const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
    return {
        privateKey: pair.privateKey,
        publicJwk: { kty: 'OKP', crv: 'Ed25519', x: jwk.x! },
    };
}

test('a receiver verifies and decrypts an extension key transfer after fresh authorization', async () => {
    await signIn();

    const identity = await peerIdentity();
    const offer = await createReceiverOffer(
        'web-device',
        '10000000-0000-4000-8000-000000000001',
        identity
    );
    let upload: UploadVaultKeyRequest | undefined;

    await context.route(`${instance}/api/v1/key-sync/receivers`, (route) =>
        route.fulfill({ json: [{ ...offer.receiver, code: 'ABC123' }] })
    );
    await context.route(
        `${instance}/api/v1/device-trust/device/web-device/identity-key`,
        (route) =>
            route.fulfill({
                json: { kty: 'OKP', crv: 'Ed25519', x: identity.publicJwk.x },
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
        type: 'handleSyncSend',
        vaultId: '10000000-0000-4000-8000-000000000001',
        code: 'ABC123',
    });

    const action = await actionPromise;

    await authorize(action);
    await expect.poll(() => upload).toBeTruthy();

    const received = await decryptVaultKey(
        {
            code: 'ABC123',
            vaultId: '10000000-0000-4000-8000-000000000001',
            senderId: 'device-1',
            senderPublicDh: upload!.publicDh.x,
            cipherText: upload!.ciphertext,
        },
        { code: 'ABC123', receiver: offer.receiver },
        offer.privateDh,
        { kty: 'OKP', crv: 'Ed25519', x: senderIdentity.x! }
    );

    expect(Array.from(received.rawKey)).toEqual(rawKey);

    await completeAndClose(action);
});

test('receiving subscribes before checking for transfers, accepts a frontend signed transfer and protects it before persistence', async () => {
    await signIn();

    const identity = await peerIdentity();
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
            new Uint8Array([1, 2, 3]).buffer,
            { code: 'ABC123', receiver },
            'web-device',
            identity
        );
        transfer = {
            code: 'ABC123',
            vaultId: '10000000-0000-4000-8000-000000000002',
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
                json: { kty: 'OKP', crv: 'Ed25519', x: identity.publicJwk.x },
            })
    );

    const actionPromise = context.waitForEvent('page');

    await pageRpc(popup, {
        type: 'handleSyncReceive',
        vaultId: '10000000-0000-4000-8000-000000000002',
    });

    const action = await actionPromise;

    await action
        .getByRole('button', { name: 'Use password', exact: true })
        .click();
    await expect(
        action.getByLabel('Protect with a vault password')
    ).toBeVisible();
    await action
        .locator('main')
        .screenshot({ path: '/tmp/mossy-v2-receive-action.png' });

    expect(order).toEqual(['init', 'events', 'keys']);

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
                            '10000000-0000-4000-8000-000000000002',
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
        .getByLabel('Confirm vault password', { exact: true })
        .fill('a different password');
    await action
        .getByRole('button', { name: 'Save password', exact: true })
        .click();
    await expect(action.getByRole('alert')).toContainText(
        'Passwords do not match.'
    );
    await uiSnapshot(action, 'vault-password-mismatch');

    await action
        .getByLabel('Protect with a vault password')
        .fill(vaultPassword);
    await action
        .getByLabel('Confirm vault password', { exact: true })
        .fill(vaultPassword);
    await action
        .getByRole('button', { name: 'Save password', exact: true })
        .click();
    await completeAndClose(action);

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
                type: 'getPopupView',
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

        await expect(
            action.getByRole('button', { name: 'Close', exact: true })
        ).toBeVisible({ timeout: 15000 });
        await completeAndClose(action);

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
            (
                await pageRpc<{ pending: unknown }>(popup, {
                    type: 'getPopupView',
                })
            ).pending
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
            type: 'getPopupView',
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
            type: 'getPopupView',
        });

        expect(replacement.pending.id).not.toBe(old.pending.id);

        await pageRpc(popup, { type: 'handleDismiss' });

        expect(
            (
                await pageRpc<{ pending: unknown }>(popup, {
                    type: 'getPopupView',
                })
            ).pending
        ).toBeNull();
        expect(saved).toBeUndefined();
    }
);

test('frontend themes, search recovery, settings and key-sync controls stay usable in the compact popup', async () => {
    await signIn();
    await popup.emulateMedia({ reducedMotion: 'reduce' });

    for (const theme of ['light', 'dark'] as const) {
        await pageRpc(popup, { type: 'handleSettings', instance, theme });
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
                name: 'Receive vault key',
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
        await expect(popup.getByLabel('Mossy instance')).toBeHidden();
        await expect(popup.getByLabel('Mossy instance')).toHaveValue(instance);
        await expect(
            popup.getByRole('radio', {
                name: theme === 'light' ? 'Light' : 'Dark',
                exact: true,
            })
        ).toBeChecked();
        await popup
            .locator('main')
            .screenshot({ path: `/tmp/mossy-v2-settings-${theme}.png` });

        const advancedSettings = popup.getByRole('button', {
            name: 'Advanced settings',
            exact: true,
        });

        await advancedSettings.focus();
        await advancedSettings.press('Enter');
        await expect(popup.getByLabel('Mossy instance')).toBeVisible();
        await expect(
            popup.getByRole('heading', {
                name: 'Only change this if you know what you’re doing',
                exact: true,
            })
        ).toBeVisible();
        await expect(popup.locator('#instance-warning')).toContainText(
            'Your sign-in credentials will be sent to this server.'
        );
        await expect(popup.getByLabel('Mossy instance')).toHaveAttribute(
            'aria-describedby',
            'instance-warning'
        );
        await popup.locator('main').screenshot({
            path: `/tmp/mossy-v2-advanced-settings-${theme}.png`,
        });
        await advancedSettings.press('Enter');
        await expect(popup.getByLabel('Mossy instance')).toBeHidden();
        await popup
            .getByRole('button', { name: 'Close settings', exact: true })
            .click();
    }

    await popup.getByRole('button', { name: 'Settings', exact: true }).click();
    // Native validation must reveal a hidden invalid field before focusing it.
    await popup
        .getByRole('button', { name: 'Advanced settings', exact: true })
        .click();
    await popup.getByLabel('Mossy instance').fill('not a URL');
    await popup
        .getByRole('button', { name: 'Advanced settings', exact: true })
        .click();
    await popup
        .getByRole('button', { name: 'Save settings', exact: true })
        .click();
    await expect(popup.getByLabel('Mossy instance')).toBeFocused();
    await expect(popup.locator('#instance-warning')).toBeVisible();
    await popup.getByLabel('Mossy instance').fill(instance);
    await popup.getByRole('radio', { name: 'System', exact: true }).check();
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
    await popup.setViewportSize({ width: 520, height: 600 });
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
        .screenshot({ path: '/tmp/mossy-v2-password-list.png' });
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

test('advanced settings animation keeps the save button below its content', async () => {
    await popup.getByRole('button', { name: 'Settings', exact: true }).click();

    for (const width of [520, 360]) {
        await popup.setViewportSize({ width, height: 620 });

        for (const reducedMotion of ['no-preference', 'reduce'] as const) {
            await popup.emulateMedia({ reducedMotion });
            await popup
                .getByRole('button', { name: 'Advanced settings', exact: true })
                .click();
            await expect(popup.getByLabel('Mossy instance')).toBeVisible();
            await expect
                .poll(() =>
                    popup.evaluate(() => {
                        const input = document.getElementById('instance')!;
                        const save = document.querySelector(
                            '#extension-settings button[type="submit"]'
                        )!;

                        return (
                            save.getBoundingClientRect().top -
                            input.getBoundingClientRect().bottom
                        );
                    })
                )
                .toBeGreaterThanOrEqual(21);
            await popup
                .getByRole('button', { name: 'Advanced settings', exact: true })
                .click();
            await expect(popup.getByLabel('Mossy instance')).toBeHidden();
        }
    }
});

test('advanced settings finishes its collapse animation before hiding the content', async () => {
    await popup.emulateMedia({ reducedMotion: 'no-preference' });
    await popup.getByRole('button', { name: 'Settings', exact: true }).click();
    const toggle = popup.getByRole('button', {
        name: 'Advanced settings',
        exact: true,
    });
    const content = popup.locator('#advanced-settings-content');
    await toggle.click();
    await expect(popup.getByLabel('Mossy instance')).toBeVisible();
    // Wait for expansion to finish before recording the closing frames.
    await expect
        .poll(() =>
            popup.getByLabel('Mossy instance').evaluate((input) => {
                const content = input.parentElement!;
                return content.clientHeight >= content.scrollHeight;
            })
        )
        .toBe(true);

    const { expanded, frames } = await content.evaluate(async (element) => {
        const expanded = element.getBoundingClientRect().height;
        const frames: number[] = [];
        document
            .querySelector<HTMLButtonElement>(
                '[aria-controls="advanced-settings-content"]'
            )!
            .click();
        const started = performance.now();
        while (performance.now() - started < 350) {
            await new Promise(requestAnimationFrame);
            frames.push(element.getBoundingClientRect().height);
        }
        return { expanded, frames };
    });
    const collapsed = await content.evaluate(
        (element) => element.getBoundingClientRect().height
    );
    expect(expanded - collapsed).toBeGreaterThan(100);
    expect(
        frames.some((height) => height > collapsed + 2 && height < expanded - 2)
    ).toBe(true);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(popup.getByLabel('Mossy instance')).toBeHidden();

    // Reversing direction during a collapse must leave the panel open.
    await toggle.press('Enter');
    await expect(popup.getByLabel('Mossy instance')).toBeVisible();
    await toggle.evaluate((element) => {
        const button = element as HTMLButtonElement;
        button.click();
        requestAnimationFrame(() => button.click());
    });
    await expect(popup.getByLabel('Mossy instance')).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
});

test('sign-in explains registration and device approval, and clears passwords after every attempt', async () => {
    await popup.emulateMedia({ reducedMotion: 'reduce' });

    const logo = popup.getByRole('heading', { name: 'Mossy', exact: true });

    await expect(
        logo.getByRole('img', { name: 'Mossy', exact: true })
    ).toHaveCount(1);
    await expect(logo).toHaveText('');
    await expect(
        popup.getByRole('heading', { name: 'Welcome back', exact: true })
    ).toBeVisible();

    const registration = popup.getByRole('link', {
        name: 'Create an account',
        exact: true,
    });

    await expect(registration).toHaveAttribute(
        'href',
        process.env.VITE_MOSSY_REGISTRATION_URL?.trim() ||
            instance + '/register'
    );
    await expect(registration).toHaveAttribute('target', '_blank');
    await expect(popup.getByText('Opens in the Mossy web app')).toBeVisible();
    await popup
        .locator('main')
        .screenshot({ path: '/tmp/mossy-v2-signed-out.png' });

    expect(
        await popup
            .locator('main')
            .evaluate((element) => element.getBoundingClientRect().height)
    ).toBeLessThanOrEqual(600);

    for (const theme of ['light', 'dark'] as const) {
        await pageRpc(popup, { type: 'handleSettings', instance, theme });
        await popup.reload();
        await expect(
            popup.getByRole('heading', { name: 'Welcome back', exact: true })
        ).toBeVisible();
        await popup
            .locator('main')
            .screenshot({ path: `/tmp/mossy-v2-sign-in-${theme}.png` });
    }

    await popup.setViewportSize({ width: 520, height: 600 });

    expect(
        await popup.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth
        )
    ).toBe(true);

    const signInButton = popup.getByRole('button', {
        name: 'Sign in',
        exact: true,
    });

    expect(
        await signInButton.evaluate(
            (element) => element.getBoundingClientRect().bottom
        )
    ).toBeLessThanOrEqual(600);

    await popup.setViewportSize({ width: 520, height: 600 });
    await seed(popup);
    await popup.getByLabel('Email or username').fill('alice');

    const passwordInput = popup.getByLabel('Account password', { exact: true });

    await passwordInput.fill('account password');
    await popup
        .getByRole('button', { name: 'Show account password', exact: true })
        .click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
    await expect(passwordInput).toHaveValue('account password');
    await expect(
        popup.getByRole('button', {
            name: 'Hide account password',
            exact: true,
        })
    ).toHaveAttribute('aria-pressed', 'true');
    await context.route(`${instance}/api/v1/auth/extension/login`, (route) =>
        route.fulfill({
            status: 401,
            json: { message: 'Check your email or username and password.' },
        })
    );
    await signInButton.click();
    await expect(
        popup
            .getByRole('form', { name: 'Sign in', exact: true })
            .getByRole('alert')
    ).toContainText('Check your email or username and password.');
    await expect(popup.getByRole('alert')).toHaveCount(1);
    await expect(passwordInput).toHaveValue('');
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(popup.getByLabel('Email or username')).toHaveValue('alice');
    await expect(signInButton).toBeEnabled();
    await expect(popup.locator('.actions button > span')).toHaveCount(0);
    await popup
        .locator('main')
        .screenshot({ path: '/tmp/mossy-v2-sign-in-error.png' });
    await context.unroute(`${instance}/api/v1/auth/extension/login`);
    await context.route(
        `${instance}/api/v1/device-trust/nonce/device-1`,
        (route) => route.fulfill({ status: 202, body: '' })
    );
    await passwordInput.fill('account password');
    await signInButton.click();
    await expect(
        popup.getByRole('heading', {
            name: 'Approve this browser',
            exact: true,
        })
    ).toBeVisible();
    await expect(popup.getByRole('alert')).toHaveCount(0);
    await expect(
        popup.getByRole('link', { name: 'Open Devices', exact: true })
    ).toHaveAttribute('href', instance + '/devices');
    await expect(passwordInput).toHaveValue('');
    await expect(signInButton).toBeEnabled();
    await expect(popup.locator('.actions button > span')).toHaveCount(0);
    await popup
        .locator('main')
        .screenshot({ path: '/tmp/mossy-v2-enrollment.png' });
    await context.unroute(`${instance}/api/v1/device-trust/nonce/device-1`);
    await passwordInput.fill('account password');
    await signInButton.click();
    await expect(
        popup.getByRole('heading', { name: 'Passwords', exact: true })
    ).toBeVisible();
});

// A tab has a fixed viewport and cannot catch toolbar popup auto-sizing loops.
test('native toolbar popup expands to its intended width', async () => {
    const cdp = await context.newCDPSession(popup);
    // Leave room for the popup and browser chrome around the toolbar anchor.
    const { windowId } = await cdp.send('Browser.getWindowForTarget');

    await cdp.send('Browser.setWindowBounds', {
        windowId,
        bounds: { width: 1100, height: 900 },
    });

    const worker =
        context.serviceWorkers()[0] ??
        (await context.waitForEvent('serviceworker'));

    await worker.evaluate(() => chrome.action.openPopup());

    let targetId: string | undefined;

    await expect
        .poll(async () => {
            const { targetInfos } = await cdp.send('Target.getTargets');
            targetId = targetInfos.find(
                (target) =>
                    target.url.endsWith('/popup.html') && !target.attached
            )?.targetId;

            return targetId;
        })
        .toBeTruthy();

    const { sessionId } = await cdp.send('Target.attachToTarget', {
        targetId: targetId!,
        flatten: false,
    });
    let requestId = 0;

    const measure = async () => {
        const id = ++requestId;
        const response = new Promise<string>((resolve, reject) => {
            const listener = (event: {
                sessionId: string;
                message: string;
            }) => {
                if (event.sessionId !== sessionId) {
                    return;
                }

                const message = JSON.parse(event.message);

                if (message.id !== id) {
                    return;
                }

                cdp.off('Target.receivedMessageFromTarget', listener);

                if (message.error) {
                    reject(new Error(message.error.message));
                } else {
                    resolve(message.result.result.value);
                }
            };

            cdp.on('Target.receivedMessageFromTarget', listener);
        });

        await cdp.send('Target.sendMessageToTarget', {
            sessionId,
            message: JSON.stringify({
                id,
                method: 'Runtime.evaluate',
                params: {
                    expression: `JSON.stringify({
                        viewport: innerWidth,
                        content: document.querySelector('main')?.getBoundingClientRect().width,
                        scroll: document.documentElement.scrollWidth
                    })`,
                    returnByValue: true,
                },
            }),
        });

        return JSON.parse(await response);
    };

    try {
        await expect.poll(measure).toEqual({
            viewport: 520,
            content: 520,
            scroll: 520,
        });
    } finally {
        await cdp.send('Target.detachFromTarget', { sessionId });
        await cdp.detach();
    }
});

test('appearance switches immediately, overrides the device theme and survives reopening', async () => {
    const actionPage = await context.newPage();

    await actionPage.goto(
        `chrome-extension://${extensionId}/action.html#expired-action`
    );
    await popup.emulateMedia({ reducedMotion: 'reduce' });

    for (const theme of ['light', 'dark', 'system'] as const) {
        await popup.emulateMedia({
            colorScheme: theme === 'dark' ? 'light' : 'dark',
        });
        await popup
            .getByRole('button', { name: 'Settings', exact: true })
            .click();
        await popup
            .getByRole('radio', {
                name:
                    theme === 'system'
                        ? 'System'
                        : theme === 'light'
                          ? 'Light'
                          : 'Dark',
                exact: true,
            })
            .check();
        await expect(
            popup.getByRole('heading', { name: 'Settings', exact: true })
        ).toBeVisible();
        await expect(
            popup.getByRole('radio', { name: 'System', exact: true })
        ).toBeEnabled();
        await expect(popup.locator('html')).toHaveAttribute(
            'data-theme',
            theme
        );
        await expect(actionPage.locator('html')).toHaveAttribute(
            'data-theme',
            theme
        );

        const background =
            theme === 'light' ? 'rgb(246, 246, 246)' : 'rgb(24, 26, 23)';

        await expect(popup.locator('body')).toHaveCSS(
            'background-color',
            background
        );
        await popup.close();
        popup = await openPopup();

        await popup.emulateMedia({
            colorScheme: theme === 'dark' ? 'light' : 'dark',
        });
        await expect(popup.locator('html')).toHaveAttribute(
            'data-theme',
            theme
        );
        await expect(popup.locator('body')).toHaveCSS(
            'background-color',
            background
        );
    }
});

async function receiveFixtureKey() {
    const identity = await peerIdentity();
    let transfer: VaultKeyResponse;

    await context.route(
        `${instance}/api/v1/key-sync/receiver-events`,
        (route) =>
            route.fulfill({
                contentType: 'text/event-stream',
                body: `data: ${JSON.stringify({ receiverId: 'device-1', code: 'ABC123', result: 'SUCCESS' })}\n\n`,
            })
    );
    await context.route(`${instance}/api/v1/key-sync`, async (route) => {
        const receiver: ReceiverDetails = {
            receiverId: 'device-1',
            ...route.request().postDataJSON(),
        };
        const upload = await encryptVaultKey(
            new Uint8Array(rawKey),
            new Uint8Array([1, 2, 3]).buffer,
            { code: 'ABC123', receiver },
            'web-device',
            identity
        );
        transfer = {
            code: 'ABC123',
            vaultId: '10000000-0000-4000-8000-000000000002',
            senderId: 'web-device',
            senderPublicDh: upload.publicDh.x,
            cipherText: upload.ciphertext,
        };

        await route.fulfill({ json: { code: 'ABC123' } });
    });
    await context.route(`${instance}/api/v1/key-sync/vault-keys`, (route) =>
        route.fulfill({ json: { keys: [transfer] } })
    );
    await context.route(
        `${instance}/api/v1/device-trust/device/web-device/identity-key`,
        (route) =>
            route.fulfill({
                json: { kty: 'OKP', crv: 'Ed25519', x: identity.publicJwk.x },
            })
    );

    const opened = context.waitForEvent('page');

    await pageRpc(popup, {
        type: 'handleSyncReceive',
        vaultId: '10000000-0000-4000-8000-000000000002',
    });

    const action = await opened;

    await expect(
        action.getByRole('group', { name: 'Vault protection method' })
    ).toBeVisible();

    return action;
}

for (const method of [
    'Use existing passkey',
    'Register new passkey',
] as const) {
    test(`received keys follow main's ${method} flow, including cancellation and credential persistence`, async () => {
        await signIn();

        const action = await receiveFixtureKey();
        for (const theme of ['light', 'dark'] as const) {
            await pageRpc(popup, { type: 'setTheme', theme });
            await expect(action.locator('html')).toHaveAttribute(
                'data-theme',
                theme
            );
            await uiSnapshot(action, `protection-choices-${theme}`);
        }

        // Simulate authenticator outputs; real native prompts remain a manual release check.
        await action.evaluate(() => {
            const calls: {
                operation: string;
                rpId: string;
                vaultId: string;
                name?: string;
                allowed?: number[];
                salt: string;
            }[] = [];
            Object.defineProperty(globalThis, 'passkeyCalls', { value: calls });

            let cancel = true;
            let registered = false;
            class FixtureCredential {
                rawId = new Uint8Array(registered ? [9, 8, 7] : [1, 2, 3])
                    .buffer;
                response = {
                    userHandle: new TextEncoder().encode(
                        '10000000-0000-4000-8000-000000000002'
                    ).buffer,
                };

                getClientExtensionResults() {
                    return {
                        prf: {
                            enabled: true,
                            results: {
                                first: new Uint8Array(32).fill(17).buffer,
                            },
                        },
                    };
                }
            }
            Object.defineProperty(globalThis, 'PublicKeyCredential', {
                value: FixtureCredential,
            });
            Object.defineProperty(navigator, 'credentials', {
                value: {
                    async get({ publicKey }: CredentialRequestOptions) {
                        calls.push({
                            operation: 'get',
                            rpId: publicKey!.rpId!,
                            vaultId: '10000000-0000-4000-8000-000000000002',
                            allowed: publicKey!.allowCredentials
                                ?.map((c) =>
                                    Array.from(
                                        new Uint8Array(c.id as ArrayBuffer)
                                    )
                                )
                                .flat(),
                            salt: new TextDecoder().decode(
                                publicKey!.extensions!.prf!.eval!.first
                            ),
                        });

                        if (cancel) {
                            cancel = false;
                            throw new DOMException(
                                'Canceled',
                                'NotAllowedError'
                            );
                        }

                        return new FixtureCredential();
                    },
                    async create({ publicKey }: CredentialCreationOptions) {
                        calls.push({
                            operation: 'create',
                            rpId: publicKey!.rp.id!,
                            vaultId: new TextDecoder().decode(
                                publicKey!.user.id
                            ),
                            name: publicKey!.user.name,
                            salt: new TextDecoder().decode(
                                publicKey!.extensions!.prf!.eval!.first
                            ),
                        });

                        if (cancel) {
                            cancel = false;
                            throw new DOMException(
                                'Canceled',
                                'NotAllowedError'
                            );
                        }

                        registered = true;

                        return new FixtureCredential();
                    },
                },
            });
        });
        await action.getByRole('button', { name: method, exact: true }).click();

        await uiSnapshot(
            action,
            method === 'Register new passkey'
                ? 'register-passkey-warning'
                : 'use-existing-passkey'
        );

        if (method === 'Register new passkey') {
            await expect(
                action.getByText('This may replace an existing passkey')
            ).toBeVisible();
        }

        await action.getByRole('button', { name: method, exact: true }).click();
        await expect(action.getByRole('alert')).toContainText(
            'The passkey prompt was closed. Try again or choose another method.'
        );
        await uiSnapshot(action, 'passkey-cancelled');

        const firstCalls = await action.evaluate(() =>
            Reflect.get(globalThis, 'passkeyCalls')
        );

        expect(firstCalls).toHaveLength(1);
        expect(firstCalls[0].operation).toBe(
            method === 'Use existing passkey' ? 'get' : 'create'
        );
        expect(firstCalls[0].rpId).toBe('mossy.dayfit.pl');
        expect(firstCalls[0].salt).toBe(
            'mossy:encryption:v1:vault:10000000-0000-4000-8000-000000000002'
        );

        if (method === 'Use existing passkey') {
            expect(firstCalls[0].allowed).toEqual([1, 2, 3]);
        } else {
            expect(firstCalls[0].vaultId).toBe(
                '10000000-0000-4000-8000-000000000002'
            );
            expect(firstCalls[0].name).toBeTruthy();
        }

        await expect(
            action.getByRole('button', { name: 'Choose another method' })
        ).toBeVisible();
        await action.getByRole('button', { name: method, exact: true }).click();
        await completeAndClose(action);

        const stored = await popup.evaluate(async () => {
            const database = await new Promise<IDBDatabase>((resolve) => {
                const request = indexedDB.open('mossy-extension-v2');
                request.onsuccess = () => resolve(request.result);
            });
            const record = await new Promise<WrappedKeyRecord>((resolve) => {
                const request = database
                    .transaction('wrapped')
                    .objectStore('wrapped')
                    .get(
                        JSON.stringify([
                            'https://mossy.dayfit.pl',
                            'user-1',
                            '10000000-0000-4000-8000-000000000002',
                        ])
                    );
                request.onsuccess = () => resolve(request.result);
            });
            database.close();

            return {
                type: record.type,
                wrappedKey: Array.from(new Uint8Array(record.wrappedKey)),
                credentialId:
                    record.type === 'PRF'
                        ? Array.from(new Uint8Array(record.credentialId))
                        : [],
            };
        });

        expect(stored.type).toBe('PRF');
        expect(stored.credentialId).toEqual(
            method === 'Use existing passkey' ? [1, 2, 3] : [9, 8, 7]
        );

        const wrapping = await importWrappingKey(new Uint8Array(32).fill(17));
        const key = await unwrapVaultKey(
            {
                type: 'PRF',
                wrappedKey: new Uint8Array(stored.wrappedKey).buffer,
                credentialId: new Uint8Array(stored.credentialId).buffer,
            },
            wrapping,
            true
        );

        expect(
            Array.from(
                new Uint8Array(await crypto.subtle.exportKey('raw', key))
            )
        ).toEqual(rawKey);
    });
}

test('vault selection works on the first click, survives refresh and reopening, and the logo returns home', async () => {
    await popup.getByRole('button', { name: 'Settings', exact: true }).click();
    await popup.getByRole('link', { name: 'Mossy home', exact: true }).click();
    await expect(
        popup.getByRole('heading', { name: 'Welcome back', exact: true })
    ).toBeVisible();
    await signIn();
    const work = popup.getByRole('button', { name: 'Work', exact: true });
    await work.click();
    await expect(work).toHaveAttribute('aria-pressed', 'true');
    await expect(work).toBeEnabled();
    await uiSnapshot(popup, 'vault-work-selected');
    await pageRpc(popup, { type: 'handleDismiss' });
    await expect(work).toHaveAttribute('aria-pressed', 'true');
    await popup.close();
    popup = await openPopup();
    await expect(
        popup.getByRole('button', { name: 'Work', exact: true })
    ).toHaveAttribute('aria-pressed', 'true');
    await popup.getByRole('searchbox').fill('missing-site');
    await popup
        .getByRole('button', { name: 'Clear search', exact: true })
        .click();
    await expect(popup.getByRole('searchbox')).toHaveValue('');
    await popup
        .getByRole('button', { name: 'Sync vault keys', exact: true })
        .click();
    await expect(
        popup.getByRole('heading', { name: 'Sync a vault key', exact: true })
    ).toBeFocused();
    await popup
        .getByRole('button', { name: 'Close key sync', exact: true })
        .click();
    await expect(
        popup.getByRole('button', { name: 'Sync vault keys', exact: true })
    ).toBeFocused();
    await popup.getByRole('button', { name: 'Settings', exact: true }).click();
    await popup.getByRole('link', { name: 'Mossy home', exact: true }).click();
    await expect(
        popup.getByRole('heading', { name: 'Passwords', exact: true })
    ).toBeVisible();
    await expect(
        popup.getByRole('button', { name: 'Work', exact: true })
    ).toHaveAttribute('aria-pressed', 'true');
    await popup.getByRole('button', { name: 'Work', exact: true }).focus();
    await popup.keyboard.press('Enter');
    await expect(
        popup.getByRole('button', { name: 'Work', exact: true })
    ).toBeEnabled();
    await popup.getByRole('button', { name: 'Personal', exact: true }).click();
    await expect(
        popup.getByRole('button', { name: 'Personal', exact: true })
    ).toBeEnabled();
    const opened = context.waitForEvent('page');
    await popup.getByRole('button', { name: 'Password', exact: true }).click();
    const action = await opened;
    await expect(
        action.getByLabel('Vault password', { exact: true })
    ).toBeVisible();
    await action.getByRole('link', { name: 'Mossy home', exact: true }).click();
    await expect(
        action.getByRole('heading', { name: 'Passwords', exact: true })
    ).toBeVisible();
    await expect.poll(() => action.workers().length).toBe(0);
});

test('UI states keep their hierarchy in both themes and respect reduced motion', async () => {
    await signIn();
    for (const theme of ['light', 'dark'] as const) {
        await pageRpc(popup, { type: 'setTheme', theme });
        await expect(popup.locator('html')).toHaveAttribute(
            'data-theme',
            theme
        );
        await uiSnapshot(popup, `passwords-${theme}`);
        expect(
            await popup.locator('.search-field').evaluate((element) => {
                const input = element.querySelector('input')!;
                const icon = element.querySelector('svg')!;
                return (
                    input.getBoundingClientRect().left +
                        parseFloat(getComputedStyle(input).paddingLeft) >
                    icon.getBoundingClientRect().right
                );
            })
        ).toBe(true);
        await popup
            .getByRole('button', { name: 'Settings', exact: true })
            .click();
        await uiSnapshot(popup, `settings-${theme}`);
        await popup
            .getByRole('button', { name: 'Advanced settings', exact: true })
            .click();
        await expect(popup.getByLabel('Mossy instance')).toBeVisible();
        await uiSnapshot(popup, `settings-advanced-${theme}`);
        await popup
            .getByRole('link', { name: 'Mossy home', exact: true })
            .click();
        await popup
            .getByRole('button', { name: 'Sync vault keys', exact: true })
            .click();
        await uiSnapshot(popup, `key-sync-${theme}`);
        await popup
            .getByRole('button', { name: 'Close key sync', exact: true })
            .click();
        await popup.getByRole('searchbox').fill('nothing-matches');
        await uiSnapshot(popup, `no-matches-${theme}`);
        await popup
            .getByRole('button', { name: 'Clear search', exact: true })
            .click();
    }
    await context.route(`${instance}/api/v1/passwords/metadata*`, (route) =>
        route.fulfill({ json: [] })
    );
    await popup.reload();
    await expect(
        popup.getByRole('heading', { name: 'No passwords yet', exact: true })
    ).toBeVisible();
    await uiSnapshot(popup, 'no-passwords-dark');
    await pageRpc(popup, { type: 'setTheme', theme: 'light' });
    await expect(popup.locator('html')).toHaveAttribute('data-theme', 'light');
    await uiSnapshot(popup, 'no-passwords-light');
    await context.route(`${instance}/api/v1/passwords/vault/vaults`, (route) =>
        route.fulfill({ json: [] })
    );
    await popup.reload();
    await expect(
        popup.getByRole('link', { name: 'Create a vault in Mossy' })
    ).toBeVisible();
    await uiSnapshot(popup, 'no-vaults-light');
    await pageRpc(popup, { type: 'setTheme', theme: 'dark' });
    await expect(popup.locator('html')).toHaveAttribute('data-theme', 'dark');
    await uiSnapshot(popup, 'no-vaults-dark');
    await context.route(`${instance}/api/v1/passwords/vault/vaults`, (route) =>
        route.fulfill({
            status: 503,
            json: { message: 'Vault service unavailable' },
        })
    );
    await popup.reload();
    await expect(popup.getByRole('alert')).toBeVisible();
    await uiSnapshot(popup, 'load-error-dark');
    await pageRpc(popup, { type: 'setTheme', theme: 'light' });
    await expect(popup.locator('html')).toHaveAttribute('data-theme', 'light');
    await uiSnapshot(popup, 'load-error-light');
    await context.unroute(`${instance}/api/v1/passwords/metadata*`);
    await context.unroute(`${instance}/api/v1/passwords/vault/vaults`);
    await pageRpc(popup, { type: 'setTheme', theme: 'dark' });
    await popup.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(
        popup.getByRole('heading', { name: 'Passwords', exact: true })
    ).toBeVisible();
    let releaseMetadata!: () => void;
    let metadataReady = new Promise<void>((resolve) => {
        releaseMetadata = resolve;
    });
    await context.route(
        `${instance}/api/v1/passwords/metadata*`,
        async (route) => {
            await metadataReady;
            await route.fallback();
        }
    );
    try {
        await popup.reload();
        await expect(
            popup.getByText('Loading Mossy…', { exact: true })
        ).toBeVisible();
        await uiSnapshot(popup, 'initial-loading-dark');
        releaseMetadata();
        await expect(
            popup.getByRole('heading', { name: 'Passwords', exact: true })
        ).toBeVisible();
        metadataReady = new Promise<void>((resolve) => {
            releaseMetadata = resolve;
        });
        await popup.getByRole('button', { name: 'Work', exact: true }).click();
        await expect(
            popup.getByText('Loading passwords…', { exact: true })
        ).toBeVisible();
        await uiSnapshot(popup, 'vault-loading-dark');
        releaseMetadata();
        await expect(
            popup.getByRole('button', { name: 'Work', exact: true })
        ).toBeEnabled();
    } finally {
        releaseMetadata();
        await context.unroute(`${instance}/api/v1/passwords/metadata*`);
    }
    await popup.emulateMedia({ reducedMotion: 'reduce' });
    await popup.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect
        .poll(() =>
            popup
                .locator('.page-content')
                .evaluate((element) => getComputedStyle(element).transform)
        )
        .toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
    await expect(
        popup.getByRole('radio', { name: 'Dark', exact: true })
    ).toBeChecked();
    await popup.getByRole('radio', { name: 'Light', exact: true }).focus();
    await popup.keyboard.press('Space');
    await expect(
        popup.getByRole('radio', { name: 'Light', exact: true })
    ).toBeChecked();
    await popup.getByRole('radio', { name: 'Light', exact: true }).focus();
    await popup.keyboard.press('ArrowRight');
    await expect(
        popup.getByRole('radio', { name: 'Dark', exact: true })
    ).toBeChecked();
});

test('receiving a missing key shows a copyable code and logo navigation cancels the transfer', async () => {
    await signIn();
    await context.route(`${instance}/api/v1/key-sync`, (route) =>
        route.fulfill({ json: { code: 'ABC123' } })
    );
    let releaseEvents!: () => void;
    const events = new Promise<void>((resolve) => {
        releaseEvents = resolve;
    });
    await context.route(
        `${instance}/api/v1/key-sync/receiver-events`,
        async (route) => {
            await events;
            await route.abort().catch(() => undefined);
        }
    );
    await popup.getByRole('button', { name: 'Work', exact: true }).click();
    await expect(
        popup.getByRole('button', { name: 'Receive key', exact: true })
    ).toBeVisible();
    const opened = context.waitForEvent('page');
    await popup
        .getByRole('button', { name: 'Receive key', exact: true })
        .click();
    const action = await opened;
    try {
        await expect(
            action.getByLabel('Receiving code', { exact: true })
        ).toHaveText('ABC123');
        expect(
            await action
                .getByRole('button', { name: 'Cancel', exact: true })
                .evaluate(
                    (element) =>
                        element.getBoundingClientRect().bottom <= innerHeight
                )
        ).toBe(true);
        popup = await openPopup();
        for (const theme of ['light', 'dark'] as const) {
            await pageRpc(popup, { type: 'setTheme', theme });
            await expect(action.locator('html')).toHaveAttribute(
                'data-theme',
                theme
            );
            await uiSnapshot(action, `receiving-code-${theme}`);
        }
        await action.evaluate(() =>
            Object.defineProperty(navigator, 'clipboard', {
                value: {
                    writeText: async (value: string) => {
                        document.documentElement.dataset.copied = value;
                    },
                },
                configurable: true,
            })
        );
        await action
            .getByRole('button', { name: 'Copy receiving code', exact: true })
            .click();
        await expect(action.locator('html')).toHaveAttribute(
            'data-copied',
            'ABC123'
        );
        await expect(
            action.getByRole('button', {
                name: 'Copy receiving code',
                exact: true,
            })
        ).toHaveText('Code copied');
        await action
            .getByRole('link', { name: 'Mossy home', exact: true })
            .click();
        await expect(
            action.getByRole('heading', { name: 'Passwords', exact: true })
        ).toBeVisible();
        await expect.poll(() => action.workers().length).toBe(0);
    } finally {
        releaseEvents();
    }
});

test(
    'captured updates let the user choose between matching entries on the first click',
    { tag: '@site' },
    async () => {
        await signIn();
        await context.route(`${instance}/api/v1/passwords/metadata*`, (route) =>
            route.fulfill({
                json: [
                    {
                        passwordId: '20000000-0000-4000-8000-000000000001',
                        identifier: 'alice',
                        address: 'https://login.example',
                        passwordType: 'PASSWORD',
                        lastModified: '2026-01-01',
                    },
                    {
                        passwordId: '20000000-0000-4000-8000-000000000002',
                        identifier: 'alice',
                        address: 'https://login.example',
                        passwordType: 'PASSWORD',
                        lastModified: '2026-02-01',
                    },
                ],
            })
        );
        await context.route(
            `${instance}/api/v1/passwords/vault/vaults`,
            (route) =>
                route.fulfill({
                    json: [
                        {
                            vaultId: '10000000-0000-4000-8000-000000000001',
                            vaultName: 'Personal',
                            isOnline: true,
                        },
                        {
                            vaultId: '10000000-0000-4000-8000-000000000002',
                            vaultName: 'Work',
                            isOnline: false,
                        },
                    ],
                })
        );
        const site = await loginForm('alice');
        await pendingPrompt(site);
        await popup.getByRole('button', { name: 'Work', exact: true }).click();
        await expect(
            popup.getByRole('button', {
                name: 'Choose an online vault',
                exact: true,
            })
        ).toBeDisabled();
        await expect(
            popup.getByRole('heading', { name: 'Work is offline', exact: true })
        ).toBeVisible();
        await uiSnapshot(popup, 'capture-offline-vault');
        await popup
            .getByRole('button', { name: 'Personal', exact: true })
            .click();
        const update = popup.getByRole('button', {
            name: 'Authorize update',
            exact: true,
        });
        await expect(update).toBeDisabled();
        await popup.getByRole('radio').nth(1).check();
        await expect(update).toBeEnabled();
        await uiSnapshot(popup, 'capture-choose-update');
        const opened = context.waitForEvent('page');
        await update.click();
        const action = await opened;
        await authorize(action);
        await expect
            .poll(() => saved?.passwordId)
            .toBe('20000000-0000-4000-8000-000000000002');
        await completeAndClose(action);
    }
);

test('scrolling over vault cards and password rows continues through the popup at inner boundaries', async () => {
    await signIn();
    await context.route(`${instance}/api/v1/passwords/vault/vaults`, (route) =>
        route.fulfill({
            json: Array.from({ length: 8 }, (_, index) => ({
                vaultId: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
                vaultName: index === 0 ? 'Personal' : `Vault ${index + 1}`,
                isOnline: true,
            })),
        })
    );
    await context.route(`${instance}/api/v1/passwords/metadata*`, (route) =>
        route.fulfill({
            json: Array.from({ length: 12 }, (_, index) => ({
                passwordId: `scroll-${index}`,
                identifier: `user-${index}`,
                address: 'https://login.example',
                passwordType: 'PASSWORD',
                lastModified: '2026-01-01',
            })),
        })
    );
    await popup.reload();
    await expect(popup.locator('.entry')).toHaveCount(12);
    const outer = popup.locator('.page-content');
    await expect
        .poll(() =>
            outer.evaluate(
                (element) => element.scrollHeight > element.clientHeight
            )
        )
        .toBe(true);
    await popup.locator('.vault-choices').evaluate((element) => {
        element.scrollTop = element.scrollHeight;
    });
    const vaultBox = (await popup.locator('.vault-choices').boundingBox())!;
    await popup.mouse.move(
        vaultBox.x + vaultBox.width / 2,
        vaultBox.y + vaultBox.height / 2
    );
    await popup.mouse.wheel(0, 300);
    await expect
        .poll(() => outer.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0);

    await outer.evaluate((element) => {
        element.scrollTop = 30;
    });
    await popup.locator('.scroll').evaluate((element) => {
        element.scrollTop = element.scrollHeight;
    });
    let rows = (await popup.locator('.scroll').boundingBox())!;
    const beforeDown = await outer.evaluate((element) => element.scrollTop);
    await popup.mouse.move(rows.x + rows.width / 2, Math.min(rows.y + 20, 580));
    await popup.mouse.wheel(0, 300);
    await expect
        .poll(() => outer.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(beforeDown);

    await popup.locator('.scroll').evaluate((element) => {
        element.scrollTop = 0;
    });
    rows = (await popup.locator('.scroll').boundingBox())!;
    const beforeUp = await outer.evaluate((element) => element.scrollTop);
    await popup.mouse.move(rows.x + rows.width / 2, Math.max(rows.y + 20, 100));
    await popup.mouse.wheel(0, -300);
    await expect
        .poll(() => outer.evaluate((element) => element.scrollTop))
        .toBeLessThan(beforeUp);

    await context.route(`${instance}/api/v1/passwords/metadata*`, (route) =>
        route.fulfill({ json: [] })
    );
    await popup.reload();
    await popup.getByRole('button', { name: 'Vault 2', exact: true }).click();
    await expect(
        popup.getByText('This browser needs this vault’s key.')
    ).toBeVisible();
    await expect(
        popup.getByRole('heading', { name: 'No passwords yet', exact: true })
    ).toBeVisible();
    await outer.evaluate((element) => {
        element.scrollTop = 30;
    });
    rows = (await popup.locator('.scroll').boundingBox())!;
    const beforeEmpty = await outer.evaluate((element) => element.scrollTop);
    await popup.mouse.move(rows.x + rows.width / 2, Math.min(rows.y + 20, 580));
    await popup.mouse.wheel(0, 300);
    await expect
        .poll(() => outer.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(beforeEmpty);
});

test('offline vaults retain navigation, survive reopening, and recover through the frontend-style status panel', async () => {
    await signIn();
    let online = false;
    let reachable = false;
    let workRequests = 0;
    const workId = '10000000-0000-4000-8000-000000000002';
    await context.route(`${instance}/api/v1/passwords/vault/vaults`, (route) =>
        route.fulfill({
            json: [
                {
                    vaultId: '10000000-0000-4000-8000-000000000001',
                    vaultName: 'Personal',
                    isOnline: true,
                },
                {
                    vaultId: workId,
                    vaultName: 'Work',
                    isOnline: online,
                    lastSeenAt: null,
                },
            ],
        })
    );
    await context.route(
        `${instance}/api/v1/passwords/metadata*`,
        async (route) => {
            if (
                new URL(route.request().url()).searchParams.get('vaultId') !==
                workId
            )
                return route.fallback();
            workRequests++;
            if (!reachable)
                return route.fulfill({
                    status: 503,
                    json: { message: `Vault ${workId} is not connected` },
                });
            return route.fulfill({
                json: [
                    {
                        passwordId: 'work-login',
                        identifier: 'work-user',
                        address: 'https://work.example',
                        passwordType: 'PASSWORD',
                        lastModified: '2026-01-01',
                    },
                ],
            });
        }
    );
    await popup.getByRole('button', { name: 'Work', exact: true }).click();
    await expect(
        popup.getByRole('heading', { name: 'Work is offline', exact: true })
    ).toBeVisible();
    await expect(
        popup.getByRole('button', { name: 'Work', exact: true })
    ).toContainText('Never connected');
    await expect(
        popup.getByRole('link', { name: 'How to start your vault' })
    ).toHaveAttribute('target', '_blank');
    await expect(
        popup.getByRole('button', { name: 'Personal', exact: true })
    ).toBeEnabled();
    await expect(
        popup.getByRole('button', { name: 'Receive key', exact: true })
    ).toHaveCount(0);
    expect(workRequests).toBe(0);
    for (const theme of ['light', 'dark'] as const) {
        await pageRpc(popup, { type: 'setTheme', theme });
        await expect(popup.locator('html')).toHaveAttribute(
            'data-theme',
            theme
        );
        await uiSnapshot(popup, `offline-vault-${theme}`);
    }
    await popup.close();
    popup = await openPopup();
    await expect(
        popup.getByRole('heading', { name: 'Work is offline', exact: true })
    ).toBeVisible();
    await expect(
        popup.getByRole('button', { name: 'Work', exact: true })
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(popup.locator('.account-label')).toHaveText('alice');
    expect(workRequests).toBe(0);

    online = true;
    await popup
        .getByRole('button', { name: 'Refresh status', exact: true })
        .click();
    await expect(
        popup.getByRole('heading', { name: 'Work is unavailable', exact: true })
    ).toBeVisible();
    await expect(
        popup.getByRole('button', { name: 'Work', exact: true })
    ).toContainText('Unavailable');
    await expect(popup.getByRole('alert')).toHaveCount(0);
    await uiSnapshot(popup, 'unavailable-vault-dark');
    reachable = true;
    await popup
        .getByRole('button', { name: 'Refresh status', exact: true })
        .click();
    await expect(
        popup.getByRole('heading', { name: 'Passwords', exact: true })
    ).toBeVisible();
    await expect(popup.getByText('work-user', { exact: true })).toBeVisible();
    await expect(
        popup.getByRole('button', { name: 'Work', exact: true })
    ).toHaveAttribute('aria-pressed', 'true');
    await popup.getByRole('button', { name: 'Personal', exact: true }).click();
    await expect(
        popup.getByText('alice', { exact: true }).last()
    ).toBeVisible();
});
