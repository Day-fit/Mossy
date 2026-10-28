import { test, expect } from './fixtures/extension';
import { pageRpc } from './helpers/actions';
import { instance, extensionId } from './fixtures/vault';

test('frontend themes, search recovery, settings and key-sync controls stay usable in the compact popup', async ({
    extension: app,
}) => {
    await app.signIn();
    await app.popup.emulateMedia({ reducedMotion: 'reduce' });

    for (const theme of ['light', 'dark'] as const) {
        await pageRpc(app.popup, { type: 'handleSettings', instance, theme });
        await app.popup.reload();
        await expect(
            app.popup.getByRole('heading', { name: 'Passwords', exact: true })
        ).toBeVisible();
        await expect(app.popup.locator('body')).toHaveCSS(
            'font-family',
            'Syne, sans-serif'
        );
        await expect(
            app.popup.getByRole('heading', { name: 'Passwords', exact: true })
        ).toHaveCSS('font-family', /^Geologica,/);
        await app.popup.getByRole('searchbox').fill('no-such-login');
        await expect(
            app.popup.getByRole('heading', { name: 'No matching passwords' })
        ).toBeVisible();
        await expect(app.popup.locator('.entry')).toHaveCount(0);
        await app.popup.locator('main').screenshot({
            path: test.info().outputPath(`mossy-v2-empty-${theme}.png`),
        });
        await app.popup.getByRole('searchbox').fill('  ALICE  ');
        await expect(app.popup.locator('.entry')).toHaveCount(1);
        await app.popup
            .getByRole('button', { name: 'Sync vault keys', exact: true })
            .click();
        await expect(
            app.popup.getByRole('heading', {
                name: 'Sync a vault key',
                exact: true,
            })
        ).toBeFocused();
        await expect(
            app.popup.getByRole('button', {
                name: 'Receive vault key',
                exact: true,
            })
        ).toBeEnabled();
        await app.popup.locator('main').screenshot({
            path: test.info().outputPath(`mossy-v2-sync-${theme}.png`),
        });
        await app.popup
            .getByRole('button', { name: 'Settings', exact: true })
            .click();
        await expect(
            app.popup.getByRole('heading', { name: 'Settings', exact: true })
        ).toBeFocused();
        await expect(app.popup.getByLabel('Mossy instance')).toBeHidden();
        await expect(app.popup.getByLabel('Mossy instance')).toHaveValue(
            instance
        );
        await expect(
            app.popup.getByRole('radio', {
                name: theme === 'light' ? 'Light' : 'Dark',
                exact: true,
            })
        ).toBeChecked();
        await app.popup.locator('main').screenshot({
            path: test.info().outputPath(`mossy-v2-settings-${theme}.png`),
        });

        const advancedSettings = app.popup.getByRole('button', {
            name: 'Advanced settings',
            exact: true,
        });

        await advancedSettings.focus();
        await advancedSettings.press('Enter');
        await expect(app.popup.getByLabel('Mossy instance')).toBeVisible();
        await expect(
            app.popup.getByRole('heading', {
                name: 'Only change this if you know what you’re doing',
                exact: true,
            })
        ).toBeVisible();
        await expect(app.popup.locator('#instance-warning')).toContainText(
            'Your sign-in credentials will be sent to this server.'
        );
        await expect(app.popup.getByLabel('Mossy instance')).toHaveAttribute(
            'aria-describedby',
            'instance-warning'
        );
        await app.popup.locator('main').screenshot({
            path: test
                .info()
                .outputPath(`mossy-v2-advanced-settings-${theme}.png`),
        });
        await advancedSettings.press('Enter');
        await expect(app.popup.getByLabel('Mossy instance')).toBeHidden();
        await app.popup
            .getByRole('button', { name: 'Close settings', exact: true })
            .click();
    }

    await app.popup
        .getByRole('button', { name: 'Settings', exact: true })
        .click();
    await app.popup
        .getByRole('button', { name: 'Advanced settings', exact: true })
        .click();
    await app.popup.getByLabel('Mossy instance').fill('not a URL');
    await app.popup
        .getByRole('button', { name: 'Advanced settings', exact: true })
        .click();
    await app.popup
        .getByRole('button', { name: 'Save settings', exact: true })
        .click();
    await expect(app.popup.getByLabel('Mossy instance')).toBeFocused();
    await expect(app.popup.locator('#instance-warning')).toBeVisible();
    await app.popup.getByLabel('Mossy instance').fill(instance);
    await app.popup.getByRole('radio', { name: 'System', exact: true }).check();
    await app.popup
        .getByRole('button', { name: 'Save settings', exact: true })
        .click();
    await expect(
        app.popup.getByRole('heading', { name: 'Passwords', exact: true })
    ).toBeVisible();
    await app.popup.reload();

    for (const colorScheme of ['light', 'dark'] as const) {
        await app.popup.emulateMedia({ colorScheme });
        await expect(app.popup.locator('body')).toHaveCSS(
            'background-color',
            colorScheme === 'dark' ? 'rgb(24, 26, 23)' : 'rgb(246, 246, 246)'
        );
    }

    await app.context.route(`${instance}/api/v1/passwords/metadata*`, (route) =>
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
    await app.popup.setViewportSize({ width: 520, height: 600 });
    await app.popup.reload();
    await expect(app.popup.locator('.entry')).toHaveCount(12);

    expect(
        await app.popup.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth
        )
    ).toBe(true);
    expect(
        await app.popup
            .locator('.scroll')
            .evaluate((element) => element.scrollHeight > element.clientHeight)
    ).toBe(true);

    await app.popup.locator('main').screenshot({
        path: test.info().outputPath('mossy-v2-password-list.png'),
    });
    await app.context.route(`${instance}/api/v1/passwords/metadata*`, (route) =>
        route.fulfill({ json: [] })
    );
    await app.popup.reload();
    await expect(
        app.popup.getByRole('heading', { name: 'No passwords yet' })
    ).toBeVisible();
    await app.context.route(
        `${instance}/api/v1/passwords/vault/vaults`,
        (route) => route.fulfill({ json: [] })
    );
    await app.popup.reload();
    await expect(
        app.popup.getByRole('link', { name: 'Create a vault in Mossy' })
    ).toBeVisible();
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
    await expect(
        app.popup.getByRole('button', { name: 'Dismiss error' })
    ).toHaveCount(0);
    await app.context.route(
        `${instance}/api/v1/passwords/vault/vaults`,
        (route) => route.fulfill({ json: [] })
    );
    await app.popup
        .getByRole('button', { name: 'Try again', exact: true })
        .click();
    await expect(
        app.popup.getByRole('link', { name: 'Create a vault in Mossy' })
    ).toBeVisible();
    await expect(app.popup.getByRole('alert')).toHaveCount(0);
});

test('advanced settings animation keeps the save button below its content', async ({
    extension: app,
}) => {
    await app.popup
        .getByRole('button', { name: 'Settings', exact: true })
        .click();

    for (const width of [520, 360]) {
        await app.popup.setViewportSize({ width, height: 620 });

        for (const reducedMotion of ['no-preference', 'reduce'] as const) {
            await app.popup.emulateMedia({ reducedMotion });
            await app.popup
                .getByRole('button', { name: 'Advanced settings', exact: true })
                .click();
            await expect(app.popup.getByLabel('Mossy instance')).toBeVisible();
            await expect
                .poll(() =>
                    app.popup.evaluate(() => {
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
            await app.popup
                .getByRole('button', { name: 'Advanced settings', exact: true })
                .click();
            await expect(app.popup.getByLabel('Mossy instance')).toBeHidden();
        }
    }
});

test('advanced settings finishes its collapse animation before hiding the content', async ({
    extension: app,
}) => {
    await app.popup.emulateMedia({ reducedMotion: 'no-preference' });
    await app.popup
        .getByRole('button', { name: 'Settings', exact: true })
        .click();
    const toggle = app.popup.getByRole('button', {
        name: 'Advanced settings',
        exact: true,
    });
    const content = app.popup.locator('#advanced-settings-content');
    await toggle.click();
    await expect(app.popup.getByLabel('Mossy instance')).toBeVisible();
    // Wait for expansion to finish before recording the closing frames.
    await expect
        .poll(() =>
            app.popup.getByLabel('Mossy instance').evaluate((input) => {
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
    await expect(app.popup.getByLabel('Mossy instance')).toBeHidden();

    // Reversing direction during a collapse must leave the panel open.
    await toggle.press('Enter');
    await expect(app.popup.getByLabel('Mossy instance')).toBeVisible();
    await toggle.evaluate((element) => {
        const button = element as HTMLButtonElement;
        button.click();
        requestAnimationFrame(() => button.click());
    });
    await expect(app.popup.getByLabel('Mossy instance')).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
});

test('appearance switches immediately, overrides the device theme and survives reopening', async ({
    extension: app,
}) => {
    const actionPage = await app.context.newPage();

    await actionPage.goto(
        `chrome-extension://${extensionId}/action.html#expired-action`
    );
    await app.popup.emulateMedia({ reducedMotion: 'reduce' });

    for (const theme of ['light', 'dark', 'system'] as const) {
        await app.popup.emulateMedia({
            colorScheme: theme === 'dark' ? 'light' : 'dark',
        });
        await app.popup
            .getByRole('button', { name: 'Settings', exact: true })
            .click();
        await app.popup
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
            app.popup.getByRole('heading', { name: 'Settings', exact: true })
        ).toBeVisible();
        await expect(
            app.popup.getByRole('radio', { name: 'System', exact: true })
        ).toBeEnabled();
        await expect(app.popup.locator('html')).toHaveAttribute(
            'data-theme',
            theme
        );
        await expect(actionPage.locator('html')).toHaveAttribute(
            'data-theme',
            theme
        );

        const background =
            theme === 'light' ? 'rgb(246, 246, 246)' : 'rgb(24, 26, 23)';

        await expect(app.popup.locator('body')).toHaveCSS(
            'background-color',
            background
        );
        await app.popup.close();
        app.popup = await app.openPopup();

        await app.popup.emulateMedia({
            colorScheme: theme === 'dark' ? 'light' : 'dark',
        });
        await expect(app.popup.locator('html')).toHaveAttribute(
            'data-theme',
            theme
        );
        await expect(app.popup.locator('body')).toHaveCSS(
            'background-color',
            background
        );
    }
});
