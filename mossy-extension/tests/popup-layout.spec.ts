import { test, expect } from './fixtures/extension';
import { pageRpc, uiSnapshot } from './helpers/actions';
import { instance } from './fixtures/vault';

// A tab has a fixed viewport and cannot catch toolbar popup auto-sizing loops.
test('native toolbar popup expands to its intended width', async ({
    extension: app,
}) => {
    const cdp = await app.context.newCDPSession(app.popup);
    const { windowId } = await cdp.send('Browser.getWindowForTarget');

    await cdp.send('Browser.setWindowBounds', {
        windowId,
        bounds: { width: 1100, height: 900 },
    });

    const worker =
        app.context.serviceWorkers()[0] ??
        (await app.context.waitForEvent('serviceworker'));

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

test('UI states keep their hierarchy in both themes and respect reduced motion', async ({
    extension: app,
}) => {
    await app.signIn();
    for (const theme of ['light', 'dark'] as const) {
        await pageRpc(app.popup, { type: 'setTheme', theme });
        await expect(app.popup.locator('html')).toHaveAttribute(
            'data-theme',
            theme
        );
        await uiSnapshot(app.popup, `passwords-${theme}`);
        expect(
            await app.popup.locator('.search-field').evaluate((element) => {
                const input = element.querySelector('input')!;
                const icon = element.querySelector('svg')!;
                return (
                    input.getBoundingClientRect().left +
                        parseFloat(getComputedStyle(input).paddingLeft) >
                    icon.getBoundingClientRect().right
                );
            })
        ).toBe(true);
        await app.popup
            .getByRole('button', { name: 'Settings', exact: true })
            .click();
        await uiSnapshot(app.popup, `settings-${theme}`);
        await app.popup
            .getByRole('button', { name: 'Advanced settings', exact: true })
            .click();
        await expect(app.popup.getByLabel('Mossy instance')).toBeVisible();
        await uiSnapshot(app.popup, `settings-advanced-${theme}`);
        await app.popup
            .getByRole('link', { name: 'Mossy home', exact: true })
            .click();
        await app.popup
            .getByRole('button', { name: 'Sync vault keys', exact: true })
            .click();
        await uiSnapshot(app.popup, `key-sync-${theme}`);
        await app.popup
            .getByRole('button', { name: 'Close key sync', exact: true })
            .click();
        await app.popup.getByRole('searchbox').fill('nothing-matches');
        await uiSnapshot(app.popup, `no-matches-${theme}`);
        await app.popup
            .getByRole('button', { name: 'Clear search', exact: true })
            .click();
    }
    await app.context.route(`${instance}/api/v1/passwords/metadata*`, (route) =>
        route.fulfill({ json: [] })
    );
    await app.popup.reload();
    await expect(
        app.popup.getByRole('heading', {
            name: 'No passwords yet',
            exact: true,
        })
    ).toBeVisible();
    await uiSnapshot(app.popup, 'no-passwords-dark');
    await pageRpc(app.popup, { type: 'setTheme', theme: 'light' });
    await expect(app.popup.locator('html')).toHaveAttribute(
        'data-theme',
        'light'
    );
    await uiSnapshot(app.popup, 'no-passwords-light');
    await app.context.route(
        `${instance}/api/v1/passwords/vault/vaults`,
        (route) => route.fulfill({ json: [] })
    );
    await app.popup.reload();
    await expect(
        app.popup.getByRole('link', { name: 'Create a vault in Mossy' })
    ).toBeVisible();
    await uiSnapshot(app.popup, 'no-vaults-light');
    await pageRpc(app.popup, { type: 'setTheme', theme: 'dark' });
    await expect(app.popup.locator('html')).toHaveAttribute(
        'data-theme',
        'dark'
    );
    await uiSnapshot(app.popup, 'no-vaults-dark');
    await app.context.route(
        `${instance}/api/v1/passwords/vault/vaults`,
        (route) =>
            route.fulfill({
                status: 503,
                json: { message: 'Vault service unavailable' },
            })
    );
    await app.popup.reload();
    await expect(app.popup.getByRole('alert')).toBeVisible();
    await uiSnapshot(app.popup, 'load-error-dark');
    await pageRpc(app.popup, { type: 'setTheme', theme: 'light' });
    await expect(app.popup.locator('html')).toHaveAttribute(
        'data-theme',
        'light'
    );
    await uiSnapshot(app.popup, 'load-error-light');
    await app.context.unroute(`${instance}/api/v1/passwords/metadata*`);
    await app.context.unroute(`${instance}/api/v1/passwords/vault/vaults`);
    await pageRpc(app.popup, { type: 'setTheme', theme: 'dark' });
    await app.popup
        .getByRole('button', { name: 'Try again', exact: true })
        .click();
    await expect(
        app.popup.getByRole('heading', { name: 'Passwords', exact: true })
    ).toBeVisible();
    let releaseMetadata!: () => void;
    let metadataReady = new Promise<void>((resolve) => {
        releaseMetadata = resolve;
    });
    await app.context.route(
        `${instance}/api/v1/passwords/metadata*`,
        async (route) => {
            await metadataReady;
            await route.fallback();
        }
    );
    try {
        await app.popup.reload();
        await expect(
            app.popup.getByText('Loading Mossy…', { exact: true })
        ).toBeVisible();
        await uiSnapshot(app.popup, 'initial-loading-dark');
        releaseMetadata();
        await expect(
            app.popup.getByRole('heading', { name: 'Passwords', exact: true })
        ).toBeVisible();
        metadataReady = new Promise<void>((resolve) => {
            releaseMetadata = resolve;
        });
        await app.popup
            .getByRole('button', { name: 'Work', exact: true })
            .click();
        await expect(
            app.popup.getByText('Loading passwords…', { exact: true })
        ).toBeVisible();
        await uiSnapshot(app.popup, 'vault-loading-dark');
        releaseMetadata();
        await expect(
            app.popup.getByRole('button', { name: 'Work', exact: true })
        ).toBeEnabled();
    } finally {
        releaseMetadata();
        await app.context.unroute(`${instance}/api/v1/passwords/metadata*`);
    }
    await app.popup.emulateMedia({ reducedMotion: 'reduce' });
    await app.popup
        .getByRole('button', { name: 'Settings', exact: true })
        .click();
    await expect
        .poll(() =>
            app.popup
                .locator('.page-content')
                .evaluate((element) => getComputedStyle(element).transform)
        )
        .toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
    await expect(
        app.popup.getByRole('radio', { name: 'Dark', exact: true })
    ).toBeChecked();
    await app.popup.getByRole('radio', { name: 'Light', exact: true }).focus();
    await app.popup.keyboard.press('Space');
    await expect(
        app.popup.getByRole('radio', { name: 'Light', exact: true })
    ).toBeChecked();
    await app.popup.getByRole('radio', { name: 'Light', exact: true }).focus();
    await app.popup.keyboard.press('ArrowRight');
    await expect(
        app.popup.getByRole('radio', { name: 'Dark', exact: true })
    ).toBeChecked();
});

test('scrolling over vault cards and password rows continues through the popup at inner boundaries', async ({
    extension: app,
}) => {
    await app.signIn();
    await app.context.route(
        `${instance}/api/v1/passwords/vault/vaults`,
        (route) =>
            route.fulfill({
                json: Array.from({ length: 8 }, (_, index) => ({
                    vaultId: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
                    vaultName: index === 0 ? 'Personal' : `Vault ${index + 1}`,
                    isOnline: true,
                })),
            })
    );
    await app.context.route(`${instance}/api/v1/passwords/metadata*`, (route) =>
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
    await app.popup.reload();
    await expect(app.popup.locator('.entry')).toHaveCount(12);
    const outer = app.popup.locator('.page-content');
    await expect
        .poll(() =>
            outer.evaluate(
                (element) => element.scrollHeight > element.clientHeight
            )
        )
        .toBe(true);
    await app.popup.locator('.vault-choices').evaluate((element) => {
        element.scrollTop = element.scrollHeight;
    });
    const vaultBox = (await app.popup.locator('.vault-choices').boundingBox())!;
    await app.popup.mouse.move(
        vaultBox.x + vaultBox.width / 2,
        vaultBox.y + vaultBox.height / 2
    );
    await app.popup.mouse.wheel(0, 300);
    await expect
        .poll(() => outer.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0);

    await outer.evaluate((element) => {
        element.scrollTop = 30;
    });
    await app.popup.locator('.scroll').evaluate((element) => {
        element.scrollTop = element.scrollHeight;
    });
    let rows = (await app.popup.locator('.scroll').boundingBox())!;
    const beforeDown = await outer.evaluate((element) => element.scrollTop);
    await app.popup.mouse.move(
        rows.x + rows.width / 2,
        Math.min(rows.y + 20, 580)
    );
    await app.popup.mouse.wheel(0, 300);
    await expect
        .poll(() => outer.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(beforeDown);

    await app.popup.locator('.scroll').evaluate((element) => {
        element.scrollTop = 0;
    });
    rows = (await app.popup.locator('.scroll').boundingBox())!;
    const beforeUp = await outer.evaluate((element) => element.scrollTop);
    await app.popup.mouse.move(
        rows.x + rows.width / 2,
        Math.max(rows.y + 20, 100)
    );
    await app.popup.mouse.wheel(0, -300);
    await expect
        .poll(() => outer.evaluate((element) => element.scrollTop))
        .toBeLessThan(beforeUp);

    await app.context.route(`${instance}/api/v1/passwords/metadata*`, (route) =>
        route.fulfill({ json: [] })
    );
    await app.popup.reload();
    await app.popup
        .getByRole('button', { name: 'Vault 2', exact: true })
        .click();
    await expect(
        app.popup.getByText('This browser needs this vault’s key.')
    ).toBeVisible();
    await expect(
        app.popup.getByRole('heading', {
            name: 'No passwords yet',
            exact: true,
        })
    ).toBeVisible();
    await outer.evaluate((element) => {
        element.scrollTop = 30;
    });
    rows = (await app.popup.locator('.scroll').boundingBox())!;
    const beforeEmpty = await outer.evaluate((element) => element.scrollTop);
    await app.popup.mouse.move(
        rows.x + rows.width / 2,
        Math.min(rows.y + 20, 580)
    );
    await app.popup.mouse.wheel(0, 300);
    await expect
        .poll(() => outer.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(beforeEmpty);
});
