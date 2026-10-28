import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { extensionId, vaultPassword } from '../fixtures/vault';

export async function pageRpc<T>(page: Page, command: unknown): Promise<T> {
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

export async function openPopup(context: BrowserContext) {
    const page = await context.newPage();

    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(
        page.getByRole('heading', { name: 'Mossy', exact: true })
    ).toBeVisible();

    return page;
}

export async function uiSnapshot(page: Page, name: string) {
    await expect
        .poll(() =>
            page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth
            )
        )
        .toBe(true);
    await page.locator('main').screenshot({
        path: test.info().outputPath(`${name}.png`),
        animations: 'disabled',
    });
}

export async function completeAndClose(page: Page) {
    await expect(
        page.getByRole('button', { name: 'Close', exact: true })
    ).toBeVisible();
    await expect.poll(() => page.workers().length).toBe(0);
    await uiSnapshot(
        page,
        `success-${(await page.locator('#action-title').innerText()).toLowerCase().replaceAll(' ', '-')}`
    );
    await Promise.all([
        page.waitForEvent('close'),
        page
            .getByRole('button', { name: 'Close', exact: true })
            .click({ noWaitAfter: true }),
    ]);
}

export async function authorize(page: Page) {
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
