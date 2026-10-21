import { ApiError } from 'mossy-api-client/client';
import { executeExtensionLoginRequest } from 'mossy-api-client/extension/auth.api';
import {
    executeDeviceLoginChallengeRequest,
    executeCreateEnrollmentRequest,
    executeConfirmEnrollmentRequest,
} from 'mossy-api-client/deviceTrust.api';
import {
    loadDeviceId,
    saveDeviceId,
    signingHandles,
    signNonce,
} from '../storage/deviceIdentity';

export async function signIn(
    instance: string,
    credentials: { identifier: string; password: string }
) {
    const identity = await signingHandles(instance);
    const deviceId = await loadDeviceId(instance, credentials.identifier);
    if (deviceId) {
        try {
            const result = await executeDeviceLoginChallengeRequest(
                deviceId,
                instance
            );
            if (result.status === 'enrollment-pending') {
                return { status: 'enrollment-pending' as const, deviceId };
            }
            const { challenge } = result;
            const login = await executeExtensionLoginRequest(instance, {
                ...credentials,
                challengeDto: {
                    deviceId,
                    challengeId: challenge.challengeId,
                    signature: await signNonce(challenge.nonce, identity),
                },
            });
            if (login.accessTokenType !== 'ACCESS_TOKEN') {
                throw new Error('Unexpected authentication token type');
            }
            return {
                status: 'authenticated' as const,
                deviceId,
                accessToken: login.accessToken,
            };
        } catch (error) {
            if (
                !(error instanceof ApiError) ||
                ![401, 404].includes(error.status)
            )
                throw error;
        }
    }

    const login = await executeExtensionLoginRequest(instance, {
        ...credentials,
        challengeDto: null,
    });
    if (login.accessTokenType !== 'DEVICE_ENROLLMENT_TOKEN') {
        throw new Error('Unexpected authentication token type');
    }
    const enrollment = await executeCreateEnrollmentRequest(
        {
            token: login.accessToken,
            idempotencyKey: crypto.randomUUID(),
            userAgent: navigator.userAgent,
            publicIdentityKey: identity.publicJwk,
        },
        instance
    );
    const confirmed = await executeConfirmEnrollmentRequest(
        {
            token: login.accessToken,
            idempotencyKey: crypto.randomUUID(),
            enrollmentId: enrollment.enrollmentId,
            challengeId: enrollment.challenge.challengeId,
            signature: await signNonce(enrollment.challenge.nonce, identity),
        },
        instance
    );
    await saveDeviceId(instance, credentials.identifier, confirmed.deviceId);
    return {
        status: 'enrollment-pending' as const,
        deviceId: confirmed.deviceId,
    };
}
