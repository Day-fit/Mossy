import {
    executeLoginRequest,
    executeRegisterRequest,
    type LoginResponse,
    type PublicIdentityJwk,
    type EmailVerification,
} from '../api/auth.api.ts';
import { executeDeviceLoginChallengeRequest } from '../api/deviceTrust.api.ts';
import { signInWithSharedCore } from './sharedCoreAdapter.ts';
import {
    ensureDeviceIdentity,
    signNonce,
    storeDeviceId,
    type CryptoPair,
} from './deviceIdentity.ts';

type Credentials = { identifier: string; password: string };

export type SignInResult =
    | { status: 'authenticated'; accessToken: string }
    | { status: 'enrollment-pending'; deviceId: string };

export type RegistrationResult =
    | { status: 'authenticated'; accessToken: string }
    | {
          status: 'verification-pending';
          verification: EmailVerification;
          identifier: string;
      };

function publicJwk(identity: CryptoPair): PublicIdentityJwk {
    if (identity.type !== 'Ed25519') {
        throw new Error('The local device identity is not an Ed25519 key');
    }

    return { kty: 'OKP', crv: 'Ed25519', x: identity.public };
}

function requireTokenType(
    response: LoginResponse,
    expected: LoginResponse['accessTokenType']
): string {
    if (response.accessTokenType !== expected) {
        throw new Error(`Unexpected authentication token type`);
    }

    return response.accessToken;
}

async function loginKnownDevice(
    credentials: Credentials,
    deviceId: string,
    identity: CryptoPair
): Promise<SignInResult> {
    const challengeResult = await executeDeviceLoginChallengeRequest(deviceId);

    if (challengeResult.status === 'enrollment-pending') {
        return { status: 'enrollment-pending', deviceId };
    }

    const { challenge } = challengeResult;
    const signature = await signNonce(challenge.nonce, identity);
    const response = await executeLoginRequest({
        ...credentials,
        challengeDto: {
            deviceId,
            challengeId: challenge.challengeId,
            signature,
        },
    });

    return {
        status: 'authenticated',
        accessToken: requireTokenType(response, 'ACCESS_TOKEN'),
    };
}

export async function registerAndSignIn(data: {
    username: string;
    email: string;
    password: string;
}): Promise<RegistrationResult> {
    const identity = await ensureDeviceIdentity();
    const registration = await executeRegisterRequest({
        ...data,
        publicIdentityKey: publicJwk(identity),
    });

    await Promise.all([
        storeDeviceId(registration.deviceId, data.username),
        storeDeviceId(registration.deviceId, data.email),
    ]);

    if (registration.verification) {
        return {
            status: 'verification-pending',
            verification: registration.verification,
            identifier: data.email,
        };
    }

    const result = await loginKnownDevice(
        { identifier: data.email, password: data.password },
        registration.deviceId,
        identity
    );

    if (result.status !== 'authenticated') {
        throw new Error(
            'Newly registered device is unexpectedly awaiting approval'
        );
    }

    return { status: 'authenticated', accessToken: result.accessToken };
}

export async function signIn(credentials: Credentials): Promise<SignInResult> {
    return signInWithSharedCore(credentials);
}
