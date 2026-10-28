import { test, expect } from './fixtures/extension';
import { pageRpc, authorize, completeAndClose } from './helpers/actions';
import { instance, extensionId } from './fixtures/vault';

test(
    'unchanged forms are rediscovered after the background worker is stopped',
    { tag: '@site' },
    async ({ extension: app }) => {
        await app.signIn();
        const site = await app.loginForm();
        await site.bringToFront();
        const view = () =>
            pageRpc<{ targets: unknown[] }>(app.popup, {
                type: 'getPopupView',
            });
        await expect.poll(async () => (await view()).targets.length).toBe(1);
        const before = await view();
        await app.context.route(
            `${instance}/api/v1/auth/extension/refresh`,
            (route) =>
                route.fulfill({
                    json: { accessToken: 'restored-access-token' },
                })
        );

        const session = await app.context.newCDPSession(site);
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

        const after = await view();
        expect(after.targets).toEqual(before.targets);
        expect(
            app.api.requests.filter(
                (request) => request.path === '/api/v1/auth/user/me'
            ).length
        ).toBeGreaterThan(1);
    }
);

test(
    'inline login suggestions authorize filling and support keyboard dismissal',
    { tag: '@site' },
    async ({ extension: app }) => {
        await app.signIn();
        const site = await app.loginForm('', '');
        const suggestions = site.locator('mossy-fill-suggestions');
        await site.getByLabel('Username').click();
        await expect(suggestions).toBeVisible();
        expect(
            await suggestions.evaluate((host) => host.shadowRoot)
        ).toBeNull();
        await expect(site.getByLabel('Password')).toHaveValue('');
        expect(
            app.api.requests.filter((request) =>
                request.path.includes('/ciphertext/')
            )
        ).toHaveLength(0);
        await site.getByLabel('Username').press('Escape');
        await expect(suggestions).toHaveCount(0);
        await site.getByLabel('Password').click();
        await expect(suggestions).toBeVisible();
        await suggestions.screenshot({
            path: test.info().outputPath('mossy-fill-suggestions.png'),
        });
        await site.getByLabel('Password').press('ArrowDown');
        const windowPromise = app.context.waitForEvent('page');
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
    async ({ extension: app }) => {
        await app.signIn();
        await pageRpc(app.popup, { type: 'setTheme', theme: 'dark' });
        const site = await app.loginForm('', '');
        await site.getByLabel('Username').click();
        const suggestions = site.locator('mossy-fill-suggestions');
        await expect(suggestions).toBeVisible();
        await suggestions.screenshot({
            path: test.info().outputPath('mossy-fill-suggestions-dark.png'),
        });
        const box = (await suggestions.boundingBox())!;
        const actionPromise = app.context.waitForEvent('page');
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
    async ({ extension: app }) => {
        await app.signIn();

        const site = await app.loginForm('', '');

        await expect
            .poll(async () => {
                const state = await pageRpc<{ targets: unknown[] }>(app.popup, {
                    type: 'getPopupView',
                    vaultId: '10000000-0000-4000-8000-000000000001',
                });

                return state.targets.length;
            })
            .toBeGreaterThan(0);

        const state = await pageRpc<{ targets: unknown[] }>(app.popup, {
            type: 'getPopupView',
            vaultId: '10000000-0000-4000-8000-000000000001',
        });
        const windowPromise = app.context.waitForEvent('page');

        await pageRpc(app.popup, {
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
        await app.popup.close();
        await site.getByRole('button', { name: 'Log in', exact: true }).click();
        app.popup = await app.openPopup();

        expect(
            (
                await pageRpc<{ pending: unknown }>(app.popup, {
                    type: 'getPopupView',
                })
            ).pending
        ).toBeNull();
    }
);

test(
    'a selected fill aborts after document navigation and leaves the replacement form untouched',
    { tag: '@site' },
    async ({ extension: app }) => {
        await app.signIn();

        const site = await app.loginForm('', '');

        await expect
            .poll(async () => {
                const state = await pageRpc<{ targets: unknown[] }>(app.popup, {
                    type: 'getPopupView',
                    vaultId: '10000000-0000-4000-8000-000000000001',
                });

                return state.targets.length;
            })
            .toBeGreaterThan(0);

        const state = await pageRpc<{ targets: unknown[] }>(app.popup, {
            type: 'getPopupView',
        });
        const actionPromise = app.context.waitForEvent('page');

        await pageRpc(app.popup, {
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
            app.api.requests.filter((request) =>
                request.path.includes('/ciphertext/')
            )
        ).toHaveLength(0);
    }
);
