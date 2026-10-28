import type { BrowserContext } from '@playwright/test';
import { instance, extensionId, type VaultFixture } from './vault';

export type ApiRequest = {
    path: string;
    method: string;
    origin?: string;
    body?: Record<string, unknown>;
};

export type MockApi = {
    requests: ApiRequest[];
    saved?: Record<string, unknown>;
    saveDelayMs: number;
};

export async function mockApi(
    context: BrowserContext,
    vault: VaultFixture
): Promise<MockApi> {
    const api: MockApi = { requests: [], saveDelayMs: 0 };
    await context.route(`${instance}/**`, async (route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        const body = request.postDataJSON();
        api.requests.push({
            path,
            method: request.method(),
            origin: request.headers()['origin'],
            body,
        });

        let data: unknown = {};
        let status = 200;
        const isPasswordWrite =
            path === '/api/v1/passwords/save' ||
            path === '/api/v1/passwords/update';
        const isCiphertextRequest = path.startsWith(
            '/api/v1/passwords/ciphertext/'
        );

        if (path === '/api/v1/auth/extension/refresh') {
            status = 401;
            data = { message: 'Sign in' };
        } else if (path === '/api/v1/device-trust/nonce/device-1') {
            data = {
                nonce: 'bm9uY2U',
                challengeId: 'challenge-1',
                expiresAt: new Date(Date.now() + 60000).toISOString(),
            };
        } else if (path === '/api/v1/auth/extension/login') {
            data = {
                accessToken: 'test-access-token',
                accessTokenType: 'ACCESS_TOKEN',
            };
        } else if (path === '/api/v1/auth/user/me') {
            data = { userId: 'user-1', username: 'alice' };
        } else if (path === '/api/v1/passwords/vault/vaults') {
            data = [
                {
                    vaultId: '10000000-0000-4000-8000-000000000001',
                    vaultName: 'Personal',
                    isOnline: true,
                },
                {
                    vaultId: '10000000-0000-4000-8000-000000000002',
                    vaultName: 'Work',
                    isOnline: true,
                },
            ];
        } else if (path === '/api/v1/passwords/metadata') {
            data = [
                {
                    passwordId: '20000000-0000-4000-8000-000000000001',
                    identifier: 'alice',
                    address: 'https://login.example',
                    passwordType: 'PASSWORD',
                    lastModified: '2026-01-01',
                },
            ];
        } else if (isCiphertextRequest) {
            data = {
                passwordId: '20000000-0000-4000-8000-000000000001',
                ciphertext: vault.ciphertext,
                type: 'CIPHERTEXT_RETRIEVAL',
            };
        } else if (isPasswordWrite) {
            api.saved = body;

            if (api.saveDelayMs) {
                await new Promise((resolve) =>
                    setTimeout(resolve, api.saveDelayMs)
                );
            }

            data = { message: 'Saved' };
        } else if (path === '/api/v1/auth/extension/logout') {
            status = 204;
        } else {
            status = 404;
            data = { message: 'Unknown test endpoint' };
        }

        await route.fulfill({
            status,
            contentType: 'application/json',
            body: status === 204 ? '' : JSON.stringify(data),
            headers: {
                'Access-Control-Allow-Origin': `chrome-extension://${extensionId}`,
                'Access-Control-Allow-Credentials': 'true',
            },
        });
    });

    return api;
}
