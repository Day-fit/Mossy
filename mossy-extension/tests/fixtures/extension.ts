import {
    test as base,
    expect,
    chromium,
    type BrowserContext,
    type Page,
} from '@playwright/test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { mockApi, type MockApi } from './api';
import {
    extensionId,
    createVaultFixture,
    seed,
    type VaultFixture,
} from './vault';
import { openPopup } from '../helpers/actions';

export { expect } from '@playwright/test';

async function createExtension(
    context: BrowserContext,
    vault: VaultFixture,
    api: MockApi
) {
    const app = {
        context,
        vault,
        api,
        popup: await openPopup(context),
        openPopup: () => openPopup(context),

        async signIn(): Promise<void> {
            await seed(app.popup, app.vault.wrapped);
            await app.popup.getByLabel('Email or username').fill('alice');
            await app.popup
                .getByLabel('Account password', { exact: true })
                .fill('account password');
            await app.popup
                .getByRole('button', { name: 'Sign in', exact: true })
                .click();
            await expect(
                app.popup.getByRole('heading', {
                    name: 'Passwords',
                    exact: true,
                })
            ).toBeVisible();
        },

        async loginForm(
            identifier = 'bob',
            password = 'captured-password',
            protocol = 'https:'
        ) {
            const allowed = await app.popup.evaluate(() =>
                chrome.permissions.contains({
                    origins: ['http://*/*', 'https://*/*'],
                })
            );

            expect(allowed).toBe(true);

            await app.context.route(`${protocol}//login.example/**`, (route) =>
                route.fulfill({
                    contentType: 'text/html',
                    body: `<!doctype html>
                        <html lang="en">
                            <body>
                                <form onsubmit="event.preventDefault()">
                                    <label>Username<input name="username" autocomplete="username"></label>
                                    <label>Password<input name="password" type="password" autocomplete="current-password"></label>
                                    <button type="submit">Log in</button>
                                </form>
                                <output id="submits">0</output>
                                <script>
                                    const output = document.getElementById('submits');
                                    document.querySelector('form').addEventListener('submit', () => {
                                        output.textContent = String(Number(output.textContent) + 1);
                                    });
                                </script>
                            </body>
                        </html>`,
                })
            );

            const site = await app.context.newPage();

            await site.goto(`${protocol}//login.example/login`);
            await site.getByLabel('Username').fill(identifier);
            await site.getByLabel('Password').fill(password);
            await site
                .getByRole('button', { name: 'Log in', exact: true })
                .focus();

            return site;
        },

        async pendingPrompt(site: Page): Promise<Page> {
            await app.popup.close();
            await site
                .getByRole('button', { name: 'Log in', exact: true })
                .click();
            // Headless Chromium may not expose the native toolbar's popup as a Page.
            app.popup =
                app.context
                    .pages()
                    .find((page) => page.url().includes('/popup.html')) ??
                (await app.openPopup());

            await expect(
                app.popup.getByRole('region', {
                    name: 'Save captured password',
                })
            ).toBeVisible();

            return app.popup;
        },
    };

    return app;
}

export type ExtensionFixture = Awaited<ReturnType<typeof createExtension>>;

export const test = base.extend<
    { extension: ExtensionFixture },
    { vault: VaultFixture }
>({
    vault: [
        // eslint-disable-next-line no-empty-pattern -- Playwright requires destructured fixtures.
        async ({}, provide) => {
            await provide(await createVaultFixture());
        },
        { scope: 'worker' },
    ],
    extension: async ({ vault }, provide, testInfo) => {
        const directory = await mkdtemp(join(tmpdir(), 'mossy-v2-browser-'));
        const extensionDirectory = resolve(
            process.env.MOSSY_TEST_EXTENSION ?? '.output/chrome-mv3'
        );
        const launch = () =>
            chromium.launchPersistentContext(directory, {
                executablePath: process.env.CHROMIUM_PATH,
                channel: 'chromium',
                headless: true,
                viewport: { width: 520, height: 620 },
                args: [
                    '--disable-extensions-except=' + extensionDirectory,
                    '--load-extension=' + extensionDirectory,
                    '--no-sandbox',
                    '--disable-dev-shm-usage',
                    '--host-resolver-rules=MAP mossy.dayfit.pl ~NOTFOUND',
                ],
            });
        let context: BrowserContext | undefined;

        try {
            context = await launch();
            const websiteAccess = testInfo.tags.includes('@site');

            if (websiteAccess) {
                await openPopup(context);
                await context.close();

                // Headless Chrome cannot approve the native host-permission dialog.
                const preferencesPath = join(
                    directory,
                    'Default',
                    'Preferences'
                );
                const preferences = JSON.parse(
                    await readFile(preferencesPath, 'utf8')
                );
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

            const api = await mockApi(context, vault);
            const app = await createExtension(context, vault, api);
            await expect(
                app.popup.getByLabel('Email or username')
            ).toBeVisible();

            if (websiteAccess) {
                const worker =
                    context.serviceWorkers()[0] ??
                    (await context.waitForEvent('serviceworker'));

                // Test the supported badge fallback without a native popup stealing focus.
                await worker.evaluate(() => {
                    chrome.action.openPopup = async () => {
                        throw new Error(
                            'Native toolbar UI unavailable in this headless fixture.'
                        );
                    };
                });
            }

            await provide(app);
        } finally {
            try {
                await context?.close();
            } finally {
                await rm(directory, { recursive: true, force: true });
            }
        }
    },
});
