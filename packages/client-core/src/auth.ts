import type { DeviceSigner, Transport } from './types.ts';
export class ApiError extends Error {
    readonly status: number;
    readonly code?: string;
    readonly retryAfter?: number;
    constructor(
        message: string,
        status: number,
        code?: string,
        retryAfter?: number
    ) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
        this.retryAfter = retryAfter;
    }
}
export type LoginResponse = {
    accessToken: string;
    accessTokenType: 'ACCESS_TOKEN' | 'DEVICE_ENROLLMENT_TOKEN';
};
export async function authenticateDevice(options: {
    transport: Transport;
    signer: DeviceSigner;
    credentials: { identifier: string; password: string };
    loginPath: string;
    loadDeviceId(): Promise<string | null>;
    saveDeviceId(id: string): Promise<void>;
    userAgent: string;
}): Promise<
    | { status: 'authenticated'; accessToken: string; deviceId: string }
    | { status: 'enrollment-pending'; deviceId: string }
> {
    const { transport, credentials, signer } = options;
    const deviceId = await options.loadDeviceId();
    if (deviceId) {
        try {
            const challenge = await transport.request<{
                nonce: string;
                challengeId: string;
            } | null>(
                `/api/v1/device-trust/nonce/${encodeURIComponent(deviceId)}`,
                { anonymous: true }
            );
            if (!challenge) return { status: 'enrollment-pending', deviceId };
            const signature = encodeBase64url(
                await signer.sign(decodeBase64url(challenge.nonce))
            );
            const response = await transport.request<LoginResponse>(
                options.loginPath,
                {
                    method: 'POST',
                    anonymous: true,
                    body: JSON.stringify({
                        ...credentials,
                        challengeDto: {
                            deviceId,
                            challengeId: challenge.challengeId,
                            signature,
                        },
                    }),
                }
            );
            if (response.accessTokenType !== 'ACCESS_TOKEN')
                throw new Error('Unexpected authentication token type');
            return {
                status: 'authenticated',
                accessToken: response.accessToken,
                deviceId,
            };
        } catch (error) {
            if (
                !(error instanceof ApiError) ||
                ![401, 404].includes(error.status)
            )
                throw error;
        }
    }
    const enrollmentLogin = await transport.request<LoginResponse>(
        options.loginPath,
        {
            method: 'POST',
            anonymous: true,
            body: JSON.stringify({ ...credentials, challengeDto: null }),
        }
    );
    if (enrollmentLogin.accessTokenType !== 'DEVICE_ENROLLMENT_TOKEN')
        throw new Error('Unexpected authentication token type');
    const enrollment = await transport.request<{
        enrollmentId: string;
        challenge: { nonce: string; challengeId: string };
    }>('/api/v1/device-trust/device/enrollment', {
        method: 'POST',
        token: enrollmentLogin.accessToken,
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
            userAgent: options.userAgent,
            publicIdentityKey: await signer.publicJwk(),
        }),
    });
    const confirmed = await transport.request<{ deviceId: string }>(
        '/api/v1/device-trust/device/enrollment/challenge',
        {
            method: 'POST',
            token: enrollmentLogin.accessToken,
            headers: { 'Idempotency-Key': crypto.randomUUID() },
            body: JSON.stringify({
                enrollmentId: enrollment.enrollmentId,
                challengeId: enrollment.challenge.challengeId,
                signature: encodeBase64url(
                    await signer.sign(
                        decodeBase64url(enrollment.challenge.nonce)
                    )
                ),
            }),
        }
    );
    await options.saveDeviceId(confirmed.deviceId);
    return { status: 'enrollment-pending', deviceId: confirmed.deviceId };
}
export const encodeBase64url = (bytes: Uint8Array) =>
    btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replaceAll('=', '');
export const decodeBase64url = (text: string) =>
    Uint8Array.from(
        atob(text.replaceAll('-', '+').replaceAll('_', '/')),
        (char) => char.charCodeAt(0)
    );
