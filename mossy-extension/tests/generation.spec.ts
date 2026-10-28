import { test, expect } from './fixtures/extension';
import { pageRpc } from './helpers/actions';

for (const protocol of ['http:', 'https:']) {
    test(
        `new-password suggestions share capture on ${protocol} without filling current passwords`,
        { tag: '@site' },
        async ({ extension: app }) => {
            await app.signIn();
            const site = await app.loginForm(
                'alice',
                'current-secret',
                protocol
            );
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
                path: test
                    .info()
                    .outputPath(
                        `mossy-generation-${protocol.slice(0, -1)}.png`
                    ),
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
                app.api.requests.filter((request) =>
                    request.path.includes('/ciphertext/')
                )
            ).toHaveLength(0);
            await site.getByLabel('Confirm password').fill('mismatch');
            await site
                .getByRole('button', { name: 'Log in', exact: true })
                .click();
            expect(
                await pageRpc<{ pending: unknown }>(app.popup, {
                    type: 'getPopupView',
                })
            ).toMatchObject({ pending: null });
            await site.getByLabel('Confirm password').fill(generated);
            await app.pendingPrompt(site);
            expect(
                await pageRpc<{ pending: { origin: string } }>(app.popup, {
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
