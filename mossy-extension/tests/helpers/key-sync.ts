import { expect } from '@playwright/test';
import type { ReceiverDetails, VaultKeyResponse } from 'mossy-api-client';
import { encryptVaultKey } from '../../src/actions/keySync';
import type { ExtensionFixture } from '../fixtures/extension';
import { instance, peerIdentity } from '../fixtures/vault';
import { pageRpc } from './actions';

export async function receiveFixtureKey(app: ExtensionFixture) {
    const identity = await peerIdentity();
    let transfer: VaultKeyResponse;

    await app.context.route(
        `${instance}/api/v1/key-sync/receiver-events`,
        (route) =>
            route.fulfill({
                contentType: 'text/event-stream',
                body: `data: ${JSON.stringify({ receiverId: 'device-1', code: 'ABC123', result: 'SUCCESS' })}\n\n`,
            })
    );
    await app.context.route(`${instance}/api/v1/key-sync`, async (route) => {
        const receiver: ReceiverDetails = {
            receiverId: 'device-1',
            ...route.request().postDataJSON(),
        };
        const upload = await encryptVaultKey(
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
            senderPublicDh: upload.publicDh.x,
            cipherText: upload.ciphertext,
        };

        await route.fulfill({ json: { code: 'ABC123' } });
    });
    await app.context.route(`${instance}/api/v1/key-sync/vault-keys`, (route) =>
        route.fulfill({ json: { keys: [transfer] } })
    );
    await app.context.route(
        `${instance}/api/v1/device-trust/device/web-device/identity-key`,
        (route) =>
            route.fulfill({
                json: { kty: 'OKP', crv: 'Ed25519', x: identity.publicJwk.x },
            })
    );

    const opened = app.context.waitForEvent('page');

    await pageRpc(app.popup, {
        type: 'handleSyncReceive',
        vaultId: '10000000-0000-4000-8000-000000000002',
    });

    const action = await opened;

    await expect(
        action.getByRole('group', { name: 'Vault protection method' })
    ).toBeVisible();

    return action;
}
