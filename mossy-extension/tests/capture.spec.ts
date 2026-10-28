import { test, expect } from './fixtures/extension';
import {
    pageRpc,
    uiSnapshot,
    authorize,
    completeAndClose,
} from './helpers/actions';
import { instance } from './fixtures/vault';

test(
    'captured submission appears in the packaged prompt, hands off without extending the deadline, and saves compatible ciphertext',
    { tag: '@site' },
    async ({ extension: app }) => {
        await app.signIn();

        const site = await app.loginForm();

        await app.pendingPrompt(site);

        const snapshot = await pageRpc<{ pending: { deadline: number } }>(
            app.popup,
            {
                type: 'getPopupView',
                vaultId: '10000000-0000-4000-8000-000000000001',
            }
        );

        expect(await app.popup.locator('body').innerText()).not.toContain(
            'captured-password'
        );

        await app.popup.locator('main').screenshot({
            path: test.info().outputPath('mossy-v2-capture.png'),
        });
        for (const theme of ['light', 'dark'] as const) {
            await pageRpc(app.popup, { type: 'setTheme', theme });
            await expect(app.popup.locator('html')).toHaveAttribute(
                'data-theme',
                theme
            );
            await uiSnapshot(app.popup, `capture-${theme}`);
        }

        const windowPromise = app.context.waitForEvent('page');

        await app.popup
            .getByRole('button', { name: 'Authorize save', exact: true })
            .click();

        const action = await windowPromise;

        await action.waitForLoadState();
        await expect(action.getByRole('timer')).toBeVisible();
        await action.locator('main').screenshot({
            path: test.info().outputPath('mossy-v2-save-action.png'),
        });
        await uiSnapshot(action, 'authorize-save-dark');
        await authorize(action);
        await expect.poll(() => app.api.saved).toBeTruthy();

        expect(app.api.saved).toMatchObject({
            vaultId: '10000000-0000-4000-8000-000000000001',
            identifier: 'bob',
            address: 'https://login.example',
            passwordType: 'PASSWORD',
        });
        expect(Date.now()).toBeLessThan(snapshot.pending.deadline);

        const key = await crypto.subtle.importKey(
            'raw',
            new Uint8Array(app.vault.rawKey),
            { name: 'AES-GCM' },
            false,
            ['decrypt']
        );
        const blob = Uint8Array.from(
            atob(String(app.api.saved!.cipherText)),
            (char) => char.charCodeAt(0)
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
    async ({ extension: app }) => {
        await app.signIn();
        await app.popup.evaluate(async () => {
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

        const site = await app.loginForm();
        await app.pendingPrompt(site);
        const opened = app.context.waitForEvent('page');
        await expect(
            app.popup.getByRole('button', {
                name: 'Receive vault key',
                exact: true,
            })
        ).toBeVisible();
        await expect(
            app.popup.getByText(
                'Receive the vault key first, then submit this login again to save it.'
            )
        ).toBeVisible();
        await uiSnapshot(app.popup, 'capture-missing-key');
        await pageRpc(app.popup, {
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
        expect(app.api.saved).toBeUndefined();
        await expect(
            pageRpc(action, {
                type: 'claimAction',
                actionId: new URL(action.url()).hash.slice(1),
            })
        ).rejects.toThrow('expired');
        app.popup = await app.openPopup();
        const view = await pageRpc<{ pending: unknown }>(app.popup, {
            type: 'getPopupView',
        });
        expect(view.pending).toBeNull();
        for (const theme of ['light', 'dark'] as const) {
            await pageRpc(app.popup, { type: 'setTheme', theme });
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
    async ({ extension: app }) => {
        await app.signIn();

        const site = await app.loginForm();

        await app.pendingPrompt(site);

        const { pending } = await pageRpc<{ pending: { deadline: number } }>(
            app.popup,
            { type: 'getPopupView' }
        );
        const windowPromise = app.context.waitForEvent('page');

        await app.popup
            .getByRole('button', { name: 'Authorize save', exact: true })
            .click();

        const action = await windowPromise;

        await expect(
            action.getByLabel('Vault password', { exact: true })
        ).toBeVisible();
        await expect
            .poll(() => action.isClosed(), {
                timeout: pending.deadline - Date.now() + 5000,
            })
            .toBe(true);

        expect(Date.now()).toBeGreaterThanOrEqual(pending.deadline);
        expect(app.api.saved).toBeUndefined();
        app.popup = await app.openPopup();

        const state = await pageRpc<{ pending: unknown }>(app.popup, {
            type: 'getPopupView',
        });

        expect(state.pending).toBeNull();
    }
);

test(
    'authorized unchanged updates are a no-op and normal redirects preserve the original captured origin',
    { tag: '@site' },
    async ({ extension: app }) => {
        await app.signIn();

        const site = await app.loginForm('alice', 'fixture-secret-password');

        await app.pendingPrompt(site);
        await site.goto('https://login.example/signed-in');
        await expect(
            app.popup
                .getByRole('region', { name: 'Save captured password' })
                .getByText('https://login.example', { exact: true })
        ).toBeVisible();

        const actionPromise = app.context.waitForEvent('page');

        await app.popup
            .getByRole('button', { name: 'Authorize update', exact: true })
            .click();

        const action = await actionPromise;

        await action.waitForLoadState();
        await authorize(action);
        await completeAndClose(action);

        expect(app.api.saved).toBeUndefined();
        expect(
            app.api.requests.filter((request) =>
                request.path.includes('/ciphertext/')
            )
        ).toHaveLength(1);
    }
);

test(
    'a save dispatched within its deadline completes after expiry without retaining its secret worker',
    { tag: '@site' },
    async ({ extension: app }) => {
        await app.signIn();

        const site = await app.loginForm();

        await app.pendingPrompt(site);

        const snapshot = await pageRpc<{ pending: { deadline: number } }>(
            app.popup,
            {
                type: 'getPopupView',
            }
        );
        app.api.saveDelayMs = snapshot.pending.deadline - Date.now() + 1000;

        const actionPromise = app.context.waitForEvent('page');

        await app.popup
            .getByRole('button', { name: 'Authorize save', exact: true })
            .click();

        const action = await actionPromise;

        await authorize(action);
        await expect.poll(() => app.api.saved).toBeTruthy();

        expect(Date.now()).toBeLessThan(snapshot.pending.deadline);

        await expect(
            action.getByRole('button', { name: 'Close', exact: true })
        ).toBeVisible({ timeout: app.api.saveDelayMs + 5000 });
        await completeAndClose(action);

        expect(Date.now()).toBeGreaterThan(snapshot.pending.deadline);
        expect(
            app.api.requests.filter((request) =>
                request.path.endsWith('/passwords/save')
            )
        ).toHaveLength(1);
    }
);

test(
    'closing the source tab cancels its pending authorization and destroys the captured candidate',
    { tag: '@site' },
    async ({ extension: app }) => {
        await app.signIn();

        const site = await app.loginForm();

        await app.pendingPrompt(site);

        const actionPromise = app.context.waitForEvent('page');

        await app.popup
            .getByRole('button', { name: 'Authorize save', exact: true })
            .click();

        const action = await actionPromise;

        await expect(
            action.getByLabel('Vault password', { exact: true })
        ).toBeVisible();
        await site.close();
        await expect.poll(() => action.isClosed()).toBe(true);
        app.popup = await app.openPopup();

        expect(
            (
                await pageRpc<{ pending: unknown }>(app.popup, {
                    type: 'getPopupView',
                })
            ).pending
        ).toBeNull();
        expect(app.api.saved).toBeUndefined();
    }
);

test(
    'a newer submission replaces the previous authorization without the old window clearing its replacement',
    { tag: '@site' },
    async ({ extension: app }) => {
        await app.signIn();

        const site = await app.loginForm();

        await app.pendingPrompt(site);

        const old = await pageRpc<{ pending: { id: string } }>(app.popup, {
            type: 'getPopupView',
        });
        const actionPromise = app.context.waitForEvent('page');

        await app.popup
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
        app.popup = await app.openPopup();

        await expect(
            app.popup.getByRole('region', { name: 'Save captured password' })
        ).toContainText('newer-identifier');

        const replacement = await pageRpc<{ pending: { id: string } }>(
            app.popup,
            {
                type: 'getPopupView',
            }
        );

        expect(replacement.pending.id).not.toBe(old.pending.id);

        await pageRpc(app.popup, { type: 'handleDismiss' });

        expect(
            (
                await pageRpc<{ pending: unknown }>(app.popup, {
                    type: 'getPopupView',
                })
            ).pending
        ).toBeNull();
        expect(app.api.saved).toBeUndefined();
    }
);

test(
    'captured updates let the user choose between matching entries on the first click',
    { tag: '@site' },
    async ({ extension: app }) => {
        await app.signIn();
        await app.context.route(
            `${instance}/api/v1/passwords/metadata*`,
            (route) =>
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
        await app.context.route(
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
        const site = await app.loginForm('alice');
        await app.pendingPrompt(site);
        await app.popup
            .getByRole('button', { name: 'Work', exact: true })
            .click();
        await expect(
            app.popup.getByRole('button', {
                name: 'Choose an online vault',
                exact: true,
            })
        ).toBeDisabled();
        await expect(
            app.popup.getByRole('heading', {
                name: 'Work is offline',
                exact: true,
            })
        ).toBeVisible();
        await uiSnapshot(app.popup, 'capture-offline-vault');
        await app.popup
            .getByRole('button', { name: 'Personal', exact: true })
            .click();
        const update = app.popup.getByRole('button', {
            name: 'Authorize update',
            exact: true,
        });
        await expect(update).toBeDisabled();
        await app.popup.getByRole('radio').nth(1).check();
        await expect(update).toBeEnabled();
        await uiSnapshot(app.popup, 'capture-choose-update');
        const opened = app.context.waitForEvent('page');
        await update.click();
        const action = await opened;
        await authorize(action);
        await expect
            .poll(() => app.api.saved?.passwordId)
            .toBe('20000000-0000-4000-8000-000000000002');
        await completeAndClose(action);
    }
);
