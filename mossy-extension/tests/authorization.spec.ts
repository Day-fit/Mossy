import { test, expect } from './fixtures/extension';
import { uiSnapshot, authorize, completeAndClose } from './helpers/actions';
import { extensionId } from './fixtures/vault';

test('a live authorization keeps its worker active past the idle timeout and still completes', async ({
    extension: app,
}) => {
    await app.signIn();
    const worker =
        app.context.serviceWorkers()[0] ??
        (await app.context.waitForEvent('serviceworker'));
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
    const opened = app.context.waitForEvent('page');
    await app.popup
        .getByRole('button', { name: 'Password', exact: true })
        .click();
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
    await action.waitForTimeout(35000);
    expect(
        await worker.evaluate(() =>
            Reflect.get(globalThis, '__actionHeartbeatCalls')
        )
    ).toBeGreaterThan(0);
    await authorize(action);
    await completeAndClose(action);
});

test('metadata and username copy need no unlock; consecutive password copies each require their own trusted window and worker', async ({
    extension: app,
}) => {
    await app.signIn();
    await app.popup.evaluate(() => {
        Object.defineProperty(navigator, 'clipboard', {
            value: {
                writeText: async (value: string) => {
                    document.documentElement.dataset.copied = value;
                },
            },
            configurable: true,
        });
    });
    await app.popup
        .getByRole('button', { name: 'Username', exact: true })
        .click();
    await expect(app.popup.locator('html')).toHaveAttribute(
        'data-copied',
        'alice'
    );
    await expect(app.popup.getByRole('status')).toContainText(
        'Username copied to clipboard.'
    );
    await uiSnapshot(app.popup, 'username-copied');

    expect(
        app.api.requests.filter((request) =>
            request.path.includes('/ciphertext/')
        )
    ).toHaveLength(0);

    await app.popup.getByRole('searchbox').fill('alice');

    expect(
        app.api.requests.filter((request) =>
            request.path.includes('/ciphertext/')
        )
    ).toHaveLength(0);

    for (let actionNumber = 0; actionNumber < 2; actionNumber++) {
        const windowPromise = app.context.waitForEvent('page');

        await app.popup
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
            app.api.requests.filter((request) =>
                request.path.includes('/ciphertext/')
            )
        ).toHaveLength(actionNumber);

        await action.locator('main').screenshot({
            path: test.info().outputPath('mossy-v2-action.png'),
        });
        await authorize(action);
        await completeAndClose(action);
        app.popup = await app.openPopup();
    }

    expect(
        app.api.requests.filter((request) =>
            request.path.includes('/ciphertext/')
        )
    ).toHaveLength(2);
    expect(
        await app.popup.evaluate(() => chrome.storage.local.get(null))
    ).not.toHaveProperty('accessToken');
});

test(
    'forged content IPC and stale action windows cannot claim privileged actions',
    { tag: '@site' },
    async ({ extension: app }) => {
        await app.signIn();

        const unrelated = await app.context.newPage();

        await unrelated.goto(
            `chrome-extension://${extensionId}/action.html#${crypto.randomUUID()}`
        );
        await expect(unrelated.getByRole('alert')).toContainText('expired');
        await unrelated.locator('main').screenshot({
            path: test.info().outputPath('mossy-v2-action-error.png'),
        });

        await app.loginForm();
        const responses = await app.popup.evaluate(async () => {
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
            app.popup.getByRole('heading', { name: 'Passwords', exact: true })
        ).toBeVisible();
    }
);
