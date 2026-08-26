import {
	executeLoginRequest,
	executeRegisterRequest,
	type LoginResponse,
	type PublicIdentityJwk,
} from '../api/auth.api.ts';
import {
	executeConfirmEnrollmentRequest,
	executeCreateEnrollmentRequest,
	executeDeviceLoginChallengeRequest,
} from '../api/deviceTrust.api.ts';
import { ApiError } from '../api/client.ts';
import {
	ensureDeviceIdentity,
	loadStoredDeviceId,
	signNonce,
	storeDeviceId,
	type CryptoPair,
} from './deviceIdentity.ts';

type Credentials = { identifier: string; password: string };

export type SignInResult =
	| { status: 'authenticated'; accessToken: string }
	| { status: 'enrollment-pending'; deviceId: string };

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

async function enrollDevice(
	credentials: Credentials,
	identity: CryptoPair
): Promise<SignInResult> {
	const enrollmentLogin = await executeLoginRequest({
		...credentials,
		challengeDto: null,
	});
	const enrollmentToken = requireTokenType(
		enrollmentLogin,
		'DEVICE_ENROLLMENT_TOKEN'
	);
	const enrollment = await executeCreateEnrollmentRequest({
		token: enrollmentToken,
		idempotencyKey: crypto.randomUUID(),
		userAgent: navigator.userAgent,
		publicIdentityKey: publicJwk(identity),
	});
	const signature = await signNonce(enrollment.challenge.nonce, identity);
	const confirmed = await executeConfirmEnrollmentRequest({
		token: enrollmentToken,
		idempotencyKey: crypto.randomUUID(),
		enrollmentId: enrollment.enrollmentId,
		challengeId: enrollment.challenge.challengeId,
		signature,
	});
	await storeDeviceId(confirmed.deviceId, credentials.identifier);

	return { status: 'enrollment-pending', deviceId: confirmed.deviceId };
}

export async function registerAndSignIn(data: {
	username: string;
	email: string;
	password: string;
}): Promise<string> {
	const identity = await ensureDeviceIdentity();
	const registration = await executeRegisterRequest({
		...data,
		publicIdentityKey: publicJwk(identity),
	});
	await Promise.all([
		storeDeviceId(registration.deviceId, data.username),
		storeDeviceId(registration.deviceId, data.email),
	]);

	const result = await loginKnownDevice(
		{ identifier: data.email, password: data.password },
		registration.deviceId,
		identity
	);

	if (result.status !== 'authenticated') {
		throw new Error('Newly registered device is unexpectedly awaiting approval');
	}

	return result.accessToken;
}

export async function signIn(credentials: Credentials): Promise<SignInResult> {
	const identity = await ensureDeviceIdentity();
	const deviceId = await loadStoredDeviceId(credentials.identifier);
	if (deviceId) {
		try {
			return await loginKnownDevice(credentials, deviceId, identity);
		} catch (error) {
			if (!(error instanceof ApiError) || ![401, 404].includes(error.status)) {
				throw error;
			}
		}
	}

	return enrollDevice(credentials, identity);
}
