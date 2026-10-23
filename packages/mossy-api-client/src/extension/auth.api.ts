import { apiFetch } from '../api/client.ts';
import type { LoginChallenge, LoginResponse } from '../api/auth.api.ts';

export async function executeExtensionLoginRequest(
    instance: string,
    data: {
        identifier: string;
        password: string;
        challengeDto: LoginChallenge | null;
    }
): Promise<LoginResponse> {
    return apiFetch(new URL('/api/v1/auth/extension/login', instance).href, {
        includeAuth: false,
        method: 'POST',
        body: JSON.stringify(data),
    }).then((response) => response.json());
}

export function executeExtensionRefreshRequest(instance: string) {
    return apiFetch(new URL('/api/v1/auth/extension/refresh', instance).href, {
        includeAuth: false,
        method: 'POST',
    });
}

export async function executeExtensionLogoutRequest(
    instance: string
): Promise<void> {
    await apiFetch(new URL('/api/v1/auth/extension/logout', instance).href, {
        includeAuth: false,
        method: 'POST',
    });
}
