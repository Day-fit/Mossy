import { ApiError } from 'mossy-api-client/client';
import {
    executeExtensionLoginRequest,
    executeExtensionLogoutRequest,
} from 'mossy-api-client/extension/auth.api';
import {
    executeDeviceLoginChallengeRequest,
    executeCreateEnrollmentRequest,
    executeConfirmEnrollmentRequest,
} from 'mossy-api-client/deviceTrust.api';
import { tokenStorage } from 'mossy-api-client/tokenStorage';
import { onPopupMessage } from '../messaging/background';
import {
    loadDeviceId,
    saveDeviceId,
    signingHandles,
    signNonce,
} from '../storage/deviceIdentity';
import { lastIdentifierSetting } from '../storage/settings';
import { getInstance } from './instance';

export function registerAuthHandlers({
    ready,
    resetSession,
}: {
    ready: Promise<void>;
    resetSession: () => void;
}) {
    onPopupMessage('handleLogin', async ({ data }) => {
        await ready;
        resetSession();
        try {
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
                            signature: await signNonce(
                                challenge.nonce,
                                identity
                            ),
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
                    signature: await signNonce(
                        enrollment.challenge.nonce,
                        identity
                    ),
                },
                instance
            );
            await saveDeviceId(instance, data.identifier, confirmed.deviceId);
            await lastIdentifierSetting.setValue(data.identifier);
            return { status: 'enrollment-pending' };
        } finally {
            data.password = '';
        }
    });

    onPopupMessage('handleLogout', async () => {
        await ready;
        const instance = await getInstance();
        resetSession();
        await executeExtensionLogoutRequest(instance);
        return { status: 'ok' };
    });
}
