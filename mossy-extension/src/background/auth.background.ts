import {
    ApiError,
    executeExtensionLoginRequest,
    executeExtensionLogoutRequest,
    executeDeviceLoginChallengeRequest,
    executeCreateEnrollmentRequest,
    executeConfirmEnrollmentRequest,
    tokenStorage,
} from 'mossy-api-client';
import { messaging } from '../messaging/rpc';
import {
    loadDeviceId,
    saveDeviceId,
    signingHandles,
    signNonce,
} from '../storage/deviceIdentity';
import { lastIdentifierSetting } from '../storage/settings';
import { getInstance } from './instance';

messaging.onMessage('handleLogin', async ({ data }) => {
    const instance = await getInstance();
    const deviceId = await loadDeviceId(instance, data.identifier);
    const identity = await signingHandles(instance);

    if (deviceId) {
        try {
            const result = await executeDeviceLoginChallengeRequest(
                deviceId,
                instance
            );
            if (result.status === 'enrollment-pending') {
                return { status: 'enrollment-pending' };
            }
            const { challenge } = result;
            const login = await executeExtensionLoginRequest(instance, {
                ...data,
                challengeDto: {
                    deviceId,
                    challengeId: challenge.challengeId,
                    signature: await signNonce(challenge.nonce, identity),
                },
            });
            tokenStorage.set(login.accessToken);
            await lastIdentifierSetting.setValue(data.identifier);
            return { status: 'authenticated' };
        } catch (error) {
            const shouldRethrowLoginError =
                !(error instanceof ApiError) ||
                ![401, 404].includes(error.status);
            if (shouldRethrowLoginError) {
                throw error;
            }
        }
    }

    const login = await executeExtensionLoginRequest(instance, {
        ...data,
        challengeDto: null,
    });
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
    await saveDeviceId(instance, data.identifier, confirmed.deviceId);
    await lastIdentifierSetting.setValue(data.identifier);
    return { status: 'enrollment-pending' };
});

messaging.onMessage('handleLogout', async () => {
    tokenStorage.set('');
    await executeExtensionLogoutRequest(await getInstance());
    return { status: 'ok' };
});