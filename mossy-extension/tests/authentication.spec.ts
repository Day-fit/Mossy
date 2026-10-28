import { test, expect } from './fixtures/extension';
import { pageRpc } from './helpers/actions';
import { instance, extensionId, seed } from './fixtures/vault';
import { readFile } from 'node:fs/promises';

test('parallel popup requests recover from expired access tokens with one refresh', async ({
    extension: app,
}) => {
    await app.signIn();
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
        await app.context.route(`${instance}${path}`, async (route) => {
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
    await app.context.route(
        `${instance}/api/v1/auth/extension/refresh`,
        async (route) => {
            refreshes++;
            await expired;
            await route.fulfill({
                json: { accessToken: 'renewed-access-token' },
            });
        }
    );
    await app.popup.reload();
    await expect(
        app.popup.getByRole('heading', { name: 'Passwords', exact: true })
    ).toBeVisible();
    await expect(
        app.popup.getByText('alice', { exact: true }).last()
    ).toBeVisible();
    expect(expiredRequests).toBe(2);
    expect(refreshes).toBe(1);
});

test('packaged MV3 has optional site permissions, strict CSP, native keys and independent extension login', async ({
    extension: app,
}) => {
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
        await app.popup.evaluate(() =>
            chrome.permissions.contains({
                origins: ['http://*/*', 'https://*/*'],
            })
        )
    ).toBe(false);
    expect(manifest.content_security_policy.extension_pages).not.toContain(
        "'unsafe-eval'"
    );
    expect(manifest.web_accessible_resources).toBeUndefined();

    await app.popup.locator('main').screenshot({
        path: test.info().outputPath('mossy-v2-signed-out.png'),
    });
    await app.signIn();
    await app.popup.locator('main').screenshot({
        path: test.info().outputPath('mossy-v2-metadata-light.png'),
    });
    await pageRpc(app.popup, {
        type: 'handleSettings',
        instance,
        theme: 'dark',
    });
    await app.popup.reload();
    await expect(app.popup.locator('body')).toHaveCSS(
        'background-color',
        'rgb(24, 26, 23)'
    );
    await app.popup.locator('main').screenshot({
        path: test.info().outputPath('mossy-v2-metadata-dark.png'),
    });

    expect(
        app.api.requests.some(
            (request) =>
                request.path === '/api/v1/auth/login' ||
                request.path === '/api/v1/auth/refresh'
        )
    ).toBe(false);

    const login = app.api.requests.find(
        (request) => request.path === '/api/v1/auth/extension/login'
    );

    expect(login?.origin).toBe(`chrome-extension://${extensionId}`);
    expect(
        await app.popup.evaluate(async () => {
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

test('sign-in explains registration and device approval, and clears passwords after every attempt', async ({
    extension: app,
}) => {
    await app.popup.emulateMedia({ reducedMotion: 'reduce' });

    const logo = app.popup.getByRole('heading', { name: 'Mossy', exact: true });

    await expect(
        logo.getByRole('img', { name: 'Mossy', exact: true })
    ).toHaveCount(1);
    await expect(logo).toHaveText('');
    await expect(
        app.popup.getByRole('heading', { name: 'Welcome back', exact: true })
    ).toBeVisible();

    const registration = app.popup.getByRole('link', {
        name: 'Create an account',
        exact: true,
    });

    await expect(registration).toHaveAttribute(
        'href',
        process.env.VITE_MOSSY_REGISTRATION_URL?.trim() ||
            instance + '/register'
    );
    await expect(registration).toHaveAttribute('target', '_blank');
    await expect(
        app.popup.getByText('Opens in the Mossy web app')
    ).toBeVisible();
    await app.popup.locator('main').screenshot({
        path: test.info().outputPath('mossy-v2-signed-out.png'),
    });

    expect(
        await app.popup
            .locator('main')
            .evaluate((element) => element.getBoundingClientRect().height)
    ).toBeLessThanOrEqual(600);

    for (const theme of ['light', 'dark'] as const) {
        await pageRpc(app.popup, { type: 'handleSettings', instance, theme });
        await app.popup.reload();
        await expect(
            app.popup.getByRole('heading', {
                name: 'Welcome back',
                exact: true,
            })
        ).toBeVisible();
        await app.popup.locator('main').screenshot({
            path: test.info().outputPath(`mossy-v2-sign-in-${theme}.png`),
        });
    }

    await app.popup.setViewportSize({ width: 520, height: 600 });

    expect(
        await app.popup.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth
        )
    ).toBe(true);

    const signInButton = app.popup.getByRole('button', {
        name: 'Sign in',
        exact: true,
    });

    expect(
        await signInButton.evaluate(
            (element) => element.getBoundingClientRect().bottom
        )
    ).toBeLessThanOrEqual(600);

    await app.popup.setViewportSize({ width: 520, height: 600 });
    await seed(app.popup, app.vault.wrapped);
    await app.popup.getByLabel('Email or username').fill('alice');

    const passwordInput = app.popup.getByLabel('Account password', {
        exact: true,
    });

    await passwordInput.fill('account password');
    await app.popup
        .getByRole('button', { name: 'Show account password', exact: true })
        .click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
    await expect(passwordInput).toHaveValue('account password');
    await expect(
        app.popup.getByRole('button', {
            name: 'Hide account password',
            exact: true,
        })
    ).toHaveAttribute('aria-pressed', 'true');
    await app.context.route(
        `${instance}/api/v1/auth/extension/login`,
        (route) =>
            route.fulfill({
                status: 401,
                json: { message: 'Check your email or username and password.' },
            })
    );
    await signInButton.click();
    await expect(
        app.popup
            .getByRole('form', { name: 'Sign in', exact: true })
            .getByRole('alert')
    ).toContainText('Check your email or username and password.');
    await expect(app.popup.getByRole('alert')).toHaveCount(1);
    await expect(passwordInput).toHaveValue('');
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(app.popup.getByLabel('Email or username')).toHaveValue(
        'alice'
    );
    await expect(signInButton).toBeEnabled();
    await expect(app.popup.locator('.actions button > span')).toHaveCount(0);
    await app.popup.locator('main').screenshot({
        path: test.info().outputPath('mossy-v2-sign-in-error.png'),
    });
    await app.context.unroute(`${instance}/api/v1/auth/extension/login`);
    await app.context.route(
        `${instance}/api/v1/device-trust/nonce/device-1`,
        (route) => route.fulfill({ status: 202, body: '' })
    );
    await passwordInput.fill('account password');
    await signInButton.click();
    await expect(
        app.popup.getByRole('heading', {
            name: 'Approve this browser',
            exact: true,
        })
    ).toBeVisible();
    await expect(app.popup.getByRole('alert')).toHaveCount(0);
    await expect(
        app.popup.getByRole('link', { name: 'Open Devices', exact: true })
    ).toHaveAttribute('href', instance + '/devices');
    await expect(passwordInput).toHaveValue('');
    await expect(signInButton).toBeEnabled();
    await expect(app.popup.locator('.actions button > span')).toHaveCount(0);
    await app.popup.locator('main').screenshot({
        path: test.info().outputPath('mossy-v2-enrollment.png'),
    });
    await app.context.unroute(`${instance}/api/v1/device-trust/nonce/device-1`);
    await passwordInput.fill('account password');
    await signInButton.click();
    await expect(
        app.popup.getByRole('heading', { name: 'Passwords', exact: true })
    ).toBeVisible();
});
