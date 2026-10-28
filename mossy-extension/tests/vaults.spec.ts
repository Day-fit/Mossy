import { test, expect } from './fixtures/extension';
import { pageRpc, uiSnapshot } from './helpers/actions';
import { instance } from './fixtures/vault';

test('vault selection works on the first click, survives refresh and reopening, and the logo returns home', async ({
    extension: app,
}) => {
    await app.popup
        .getByRole('button', { name: 'Settings', exact: true })
        .click();
    await app.popup
        .getByRole('link', { name: 'Mossy home', exact: true })
        .click();
    await expect(
        app.popup.getByRole('heading', { name: 'Welcome back', exact: true })
    ).toBeVisible();
    await app.signIn();
    const work = app.popup.getByRole('button', { name: 'Work', exact: true });
    await work.click();
    await expect(work).toHaveAttribute('aria-pressed', 'true');
    await expect(work).toBeEnabled();
    await uiSnapshot(app.popup, 'vault-work-selected');
    await pageRpc(app.popup, { type: 'handleDismiss' });
    await expect(work).toHaveAttribute('aria-pressed', 'true');
    await app.popup.close();
    app.popup = await app.openPopup();
    await expect(
        app.popup.getByRole('button', { name: 'Work', exact: true })
    ).toHaveAttribute('aria-pressed', 'true');
    await app.popup.getByRole('searchbox').fill('missing-site');
    await app.popup
        .getByRole('button', { name: 'Clear search', exact: true })
        .click();
    await expect(app.popup.getByRole('searchbox')).toHaveValue('');
    await app.popup
        .getByRole('button', { name: 'Sync vault keys', exact: true })
        .click();
    await expect(
        app.popup.getByRole('heading', {
            name: 'Sync a vault key',
            exact: true,
        })
    ).toBeFocused();
    await app.popup
        .getByRole('button', { name: 'Close key sync', exact: true })
        .click();
    await expect(
        app.popup.getByRole('button', { name: 'Sync vault keys', exact: true })
    ).toBeFocused();
    await app.popup
        .getByRole('button', { name: 'Settings', exact: true })
        .click();
    await app.popup
        .getByRole('link', { name: 'Mossy home', exact: true })
        .click();
    await expect(
        app.popup.getByRole('heading', { name: 'Passwords', exact: true })
    ).toBeVisible();
    await expect(
        app.popup.getByRole('button', { name: 'Work', exact: true })
    ).toHaveAttribute('aria-pressed', 'true');
    await app.popup.getByRole('button', { name: 'Work', exact: true }).focus();
    await app.popup.keyboard.press('Enter');
    await expect(
        app.popup.getByRole('button', { name: 'Work', exact: true })
    ).toBeEnabled();
    await app.popup
        .getByRole('button', { name: 'Personal', exact: true })
        .click();
    await expect(
        app.popup.getByRole('button', { name: 'Personal', exact: true })
    ).toBeEnabled();
    const opened = app.context.waitForEvent('page');
    await app.popup
        .getByRole('button', { name: 'Password', exact: true })
        .click();
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

test('offline vaults retain navigation, survive reopening, and recover through the frontend-style status panel', async ({
    extension: app,
}) => {
    await app.signIn();
    let online = false;
    let reachable = false;
    let workRequests = 0;
    const workId = '10000000-0000-4000-8000-000000000002';
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
                        vaultId: workId,
                        vaultName: 'Work',
                        isOnline: online,
                        lastSeenAt: null,
                    },
                ],
            })
    );
    await app.context.route(
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
    await app.popup.getByRole('button', { name: 'Work', exact: true }).click();
    await expect(
        app.popup.getByRole('heading', { name: 'Work is offline', exact: true })
    ).toBeVisible();
    await expect(
        app.popup.getByRole('button', { name: 'Work', exact: true })
    ).toContainText('Never connected');
    await expect(
        app.popup.getByRole('link', { name: 'How to start your vault' })
    ).toHaveAttribute('target', '_blank');
    await expect(
        app.popup.getByRole('button', { name: 'Personal', exact: true })
    ).toBeEnabled();
    await expect(
        app.popup.getByRole('button', { name: 'Receive key', exact: true })
    ).toHaveCount(0);
    expect(workRequests).toBe(0);
    for (const theme of ['light', 'dark'] as const) {
        await pageRpc(app.popup, { type: 'setTheme', theme });
        await expect(app.popup.locator('html')).toHaveAttribute(
            'data-theme',
            theme
        );
        await uiSnapshot(app.popup, `offline-vault-${theme}`);
    }
    await app.popup.close();
    app.popup = await app.openPopup();
    await expect(
        app.popup.getByRole('heading', { name: 'Work is offline', exact: true })
    ).toBeVisible();
    await expect(
        app.popup.getByRole('button', { name: 'Work', exact: true })
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(app.popup.locator('.account-label')).toHaveText('alice');
    expect(workRequests).toBe(0);

    online = true;
    await app.popup
        .getByRole('button', { name: 'Refresh status', exact: true })
        .click();
    await expect(
        app.popup.getByRole('heading', {
            name: 'Work is unavailable',
            exact: true,
        })
    ).toBeVisible();
    await expect(
        app.popup.getByRole('button', { name: 'Work', exact: true })
    ).toContainText('Unavailable');
    await expect(app.popup.getByRole('alert')).toHaveCount(0);
    await uiSnapshot(app.popup, 'unavailable-vault-dark');
    reachable = true;
    await app.popup
        .getByRole('button', { name: 'Refresh status', exact: true })
        .click();
    await expect(
        app.popup.getByRole('heading', { name: 'Passwords', exact: true })
    ).toBeVisible();
    await expect(
        app.popup.getByText('work-user', { exact: true })
    ).toBeVisible();
    await expect(
        app.popup.getByRole('button', { name: 'Work', exact: true })
    ).toHaveAttribute('aria-pressed', 'true');
    await app.popup
        .getByRole('button', { name: 'Personal', exact: true })
        .click();
    await expect(
        app.popup.getByText('alice', { exact: true }).last()
    ).toBeVisible();
});
