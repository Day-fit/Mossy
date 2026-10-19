import {
    authenticateDevice,
    encodeBase64url,
    decodeBase64url,
    type Transport,
} from '@mossy/client-core';
import { executeLoginRequest } from '../api/auth.api.ts';
import {
    executeConfirmEnrollmentRequest,
    executeCreateEnrollmentRequest,
    executeDeviceLoginChallengeRequest,
} from '../api/deviceTrust.api.ts';
import {
    ensureDeviceIdentity,
    loadStoredDeviceId,
    signNonce,
    storeDeviceId,
} from './deviceIdentity.ts';
export async function signInWithSharedCore(credentials: {
    identifier: string;
    password: string;
}) {
    const identity = await ensureDeviceIdentity();
    const transport: Transport = {
        async request<T>(
            path: string,
            options: RequestInit & { token?: string; anonymous?: boolean } = {}
        ) {
            const data = options.body
                ? JSON.parse(String(options.body))
                : undefined;
            if (path.startsWith('/api/v1/device-trust/nonce/')) {
                const response = await executeDeviceLoginChallengeRequest(
                    decodeURIComponent(path.split('/').at(-1)!)
                );
                return (
                    response.status === 'enrollment-pending'
                        ? null
                        : response.challenge
                ) as T;
            }
            if (path === '/api/v1/auth/login')
                return (await executeLoginRequest(data)) as T;
            if (path === '/api/v1/device-trust/device/enrollment')
                return (await executeCreateEnrollmentRequest({
                    ...data,
                    token: options.token!,
                    idempotencyKey: (options.headers as Record<string, string>)[
                        'Idempotency-Key'
                    ],
                })) as T;
            if (path === '/api/v1/device-trust/device/enrollment/challenge')
                return (await executeConfirmEnrollmentRequest({
                    ...data,
                    token: options.token!,
                    idempotencyKey: (options.headers as Record<string, string>)[
                        'Idempotency-Key'
                    ],
                })) as T;
            throw new Error('Unknown authentication operation.');
        },
    };
    const result = await authenticateDevice({
        transport,
        signer: {
            publicJwk: async () => ({
                kty: 'OKP',
                crv: 'Ed25519',
                x: identity.public,
            }),
            sign: async (bytes) =>
                decodeBase64url(
                    await signNonce(encodeBase64url(bytes), identity)
                ),
        },
        credentials,
        loginPath: '/api/v1/auth/login',
        loadDeviceId: () => loadStoredDeviceId(credentials.identifier),
        saveDeviceId: (id) => storeDeviceId(id, credentials.identifier),
        userAgent: navigator.userAgent,
    });
    return result.status === 'authenticated'
        ? { status: 'authenticated' as const, accessToken: result.accessToken }
        : result;
}
