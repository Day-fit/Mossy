import { test, expect } from './fixtures/extension';
import {
    pageRpc,
    uiSnapshot,
    authorize,
    completeAndClose,
} from './helpers/actions';
import { instance, vaultPassword, peerIdentity } from './fixtures/vault';
import {
    passwordWrappingKey,
    decryptWithKey,
    unwrapVaultKey,
} from '../src/security/vaultCrypto';
import {
    createReceiverOffer,
    encryptVaultKey,
    decryptVaultKey,
} from '../src/actions/keySync';
import {
    type ReceiverDetails,
    type VaultKeyResponse,
    type UploadVaultKeyRequest,
} from 'mossy-api-client';
import { type WrappedKeyRecord } from '../src/types/vault';

test('a receiver verifies and decrypts an extension key transfer after fresh authorization', async ({
    extension: app,
}) => {
    await app.signIn();

    const identity = await peerIdentity();
    const offer = await createReceiverOffer(
        'web-device',
        '10000000-0000-4000-8000-000000000001',
        identity
    );
    let upload: UploadVaultKeyRequest | undefined;

    await app.context.route(`${instance}/api/v1/key-sync/receivers`, (route) =>
        route.fulfill({ json: [{ ...offer.receiver, code: 'ABC123' }] })
    );
    await app.context.route(
        `${instance}/api/v1/device-trust/device/web-device/identity-key`,
        (route) =>
            route.fulfill({
                json: { kty: 'OKP', crv: 'Ed25519', x: identity.publicJwk.x },
            })
    );
    await app.context.route(
        `${instance}/api/v1/key-sync/ABC123`,
        async (route) => {
            upload = route.request().postDataJSON();

            await route.fulfill({ json: {} });
        }
    );

    const senderIdentity = await app.popup.evaluate(async () => {
        const database = await new Promise<IDBDatabase>((resolve) => {
            const request = indexedDB.open('mossy-extension-v2');
            request.onsuccess = () => resolve(request.result);
        });
        const pair = await new Promise<CryptoKeyPair>((resolve) => {
            const request = database
                .transaction('device')
                .objectStore('device')
                .get(['identity', 'https://mossy.dayfit.pl']);
            request.onsuccess = () => resolve(request.result);
        });

        return crypto.subtle.exportKey('jwk', pair.publicKey);
    });
    const actionPromise = app.context.waitForEvent('page');

    await pageRpc(app.popup, {
        type: 'handleSyncSend',
        vaultId: '10000000-0000-4000-8000-000000000001',
        code: 'ABC123',
    });

    const action = await actionPromise;

    await authorize(action);
    await expect.poll(() => upload).toBeTruthy();

    const received = await decryptVaultKey(
        {
            code: 'ABC123',
            vaultId: '10000000-0000-4000-8000-000000000001',
            senderId: 'device-1',
            senderPublicDh: upload!.publicDh.x,
            cipherText: upload!.ciphertext,
        },
        { code: 'ABC123', receiver: offer.receiver },
        offer.privateDh,
        { kty: 'OKP', crv: 'Ed25519', x: senderIdentity.x! }
    );

    expect(Array.from(received.rawKey)).toEqual(app.vault.rawKey);

    await completeAndClose(action);
});

test('receiving subscribes before checking for transfers, accepts a frontend signed transfer and protects it before persistence', async ({
    extension: app,
}) => {
    await app.signIn();

    const identity = await peerIdentity();
    const order: string[] = [];
    let transfer: VaultKeyResponse | undefined;

    await app.context.route(
        `${instance}/api/v1/key-sync/receiver-events`,
        async (route) => {
            order.push('events');

            await route.fulfill({
                contentType: 'text/event-stream',
                body: `data: ${JSON.stringify({ receiverId: 'device-1', code: 'ABC123', result: 'SUCCESS' })}\n\n`,
            });
        }
    );
    await app.context.route(`${instance}/api/v1/key-sync`, async (route) => {
        order.push('init');

        const body = route.request().postDataJSON();
        const receiver: ReceiverDetails = { receiverId: 'device-1', ...body };
        const encrypted = await encryptVaultKey(
            new Uint8Array(app.vault.rawKey),
            new Uint8Array([1, 2, 3]).buffer,
            { code: 'ABC123', receiver },
            'web-device',
            identity
        );
        transfer = {
            code: 'ABC123',
            vaultId: '10000000-0000-4000-8000-000000000002',
            senderId: 'web-device',
            senderPublicDh: encrypted.publicDh.x,
            cipherText: encrypted.ciphertext,
        };

        await route.fulfill({ json: { code: 'ABC123' } });
    });
    await app.context.route(
        `${instance}/api/v1/key-sync/vault-keys`,
        async (route) => {
            order.push('keys');

            await route.fulfill({ json: { keys: [transfer] } });
        }
    );
    await app.context.route(
        `${instance}/api/v1/device-trust/device/web-device/identity-key`,
        (route) =>
            route.fulfill({
                json: { kty: 'OKP', crv: 'Ed25519', x: identity.publicJwk.x },
            })
    );

    const actionPromise = app.context.waitForEvent('page');

    await pageRpc(app.popup, {
        type: 'handleSyncReceive',
        vaultId: '10000000-0000-4000-8000-000000000002',
    });

    const action = await actionPromise;

    await action
        .getByRole('button', { name: 'Use password', exact: true })
        .click();
    await expect(
        action.getByLabel('Protect with a vault password')
    ).toBeVisible();
    await action.locator('main').screenshot({
        path: test.info().outputPath('mossy-v2-receive-action.png'),
    });

    expect(order).toEqual(['init', 'events', 'keys']);

    const readWrapped = () =>
        app.popup.evaluate(async () => {
            const database = await new Promise<IDBDatabase>((resolve) => {
                const request = indexedDB.open('mossy-extension-v2');
                request.onsuccess = () => resolve(request.result);
            });

            return new Promise<
                | { type: string; wrappedKey: number[]; salt: number[] }
                | undefined
            >((resolve) => {
                const request = database
                    .transaction('wrapped')
                    .objectStore('wrapped')
                    .get(
                        JSON.stringify([
                            'https://mossy.dayfit.pl',
                            'user-1',
                            '10000000-0000-4000-8000-000000000002',
                        ])
                    );
                request.onsuccess = () =>
                    resolve(
                        request.result
                            ? {
                                  type: request.result.type,
                                  wrappedKey: Array.from(
                                      new Uint8Array(request.result.wrappedKey)
                                  ),
                                  salt: Array.from(request.result.salt),
                              }
                            : undefined
                    );
            });
        });

    expect(await readWrapped()).toBeUndefined();

    await action
        .getByLabel('Protect with a vault password')
        .fill(vaultPassword);
    await action
        .getByLabel('Confirm vault password', { exact: true })
        .fill('a different password');
    await action
        .getByRole('button', { name: 'Save password', exact: true })
        .click();
    await expect(action.getByRole('alert')).toContainText(
        'Passwords do not match.'
    );
    await uiSnapshot(action, 'vault-password-mismatch');

    await action
        .getByLabel('Protect with a vault password')
        .fill(vaultPassword);
    await action
        .getByLabel('Confirm vault password', { exact: true })
        .fill(vaultPassword);
    await action
        .getByRole('button', { name: 'Save password', exact: true })
        .click();
    await completeAndClose(action);

    const stored = await readWrapped();

    expect(stored?.type).toBe('Password');

    const wrapping = await passwordWrappingKey(
        vaultPassword,
        new Uint8Array(stored!.salt)
    );
    const key = await unwrapVaultKey(
        {
            type: 'Password',
            wrappedKey: new Uint8Array(stored!.wrappedKey).buffer,
            salt: new Uint8Array(stored!.salt),
        } satisfies WrappedKeyRecord,
        wrapping
    );

    expect(key.extractable).toBe(false);
    expect(
        JSON.parse(await decryptWithKey(app.vault.ciphertext, key)).password
    ).toBe('fixture-secret-password');
});

test('receiving a missing key shows a copyable code and logo navigation cancels the transfer', async ({
    extension: app,
}) => {
    await app.signIn();
    await app.context.route(`${instance}/api/v1/key-sync`, (route) =>
        route.fulfill({ json: { code: 'ABC123' } })
    );
    let releaseEvents!: () => void;
    const events = new Promise<void>((resolve) => {
        releaseEvents = resolve;
    });
    await app.context.route(
        `${instance}/api/v1/key-sync/receiver-events`,
        async (route) => {
            await events;
            await route.abort().catch(() => undefined);
        }
    );
    await app.popup.getByRole('button', { name: 'Work', exact: true }).click();
    await expect(
        app.popup.getByRole('button', { name: 'Receive key', exact: true })
    ).toBeVisible();
    const opened = app.context.waitForEvent('page');
    await app.popup
        .getByRole('button', { name: 'Receive key', exact: true })
        .click();
    const action = await opened;
    try {
        await expect(
            action.getByLabel('Receiving code', { exact: true })
        ).toHaveText('ABC123');
        expect(
            await action
                .getByRole('button', { name: 'Cancel', exact: true })
                .evaluate(
                    (element) =>
                        element.getBoundingClientRect().bottom <= innerHeight
                )
        ).toBe(true);
        app.popup = await app.openPopup();
        for (const theme of ['light', 'dark'] as const) {
            await pageRpc(app.popup, { type: 'setTheme', theme });
            await expect(action.locator('html')).toHaveAttribute(
                'data-theme',
                theme
            );
            await uiSnapshot(action, `receiving-code-${theme}`);
        }
        await action.evaluate(() =>
            Object.defineProperty(navigator, 'clipboard', {
                value: {
                    writeText: async (value: string) => {
                        document.documentElement.dataset.copied = value;
                    },
                },
                configurable: true,
            })
        );
        await action
            .getByRole('button', { name: 'Copy receiving code', exact: true })
            .click();
        await expect(action.locator('html')).toHaveAttribute(
            'data-copied',
            'ABC123'
        );
        await expect(
            action.getByRole('button', {
                name: 'Copy receiving code',
                exact: true,
            })
        ).toHaveText('Code copied');
        await action
            .getByRole('link', { name: 'Mossy home', exact: true })
            .click();
        await expect(
            action.getByRole('heading', { name: 'Passwords', exact: true })
        ).toBeVisible();
        await expect.poll(() => action.workers().length).toBe(0);
    } finally {
        releaseEvents();
    }
});
