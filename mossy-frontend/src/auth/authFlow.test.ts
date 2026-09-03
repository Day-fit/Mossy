import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client.ts';
import { registerAndSignIn, signIn } from './authFlow.ts';

const authApi = vi.hoisted(() => ({
	executeLoginRequest: vi.fn(),
	executeRegisterRequest: vi.fn(),
}));
const deviceTrustApi = vi.hoisted(() => ({
	executeDeviceLoginChallengeRequest: vi.fn(),
	executeCreateEnrollmentRequest: vi.fn(),
	executeConfirmEnrollmentRequest: vi.fn(),
}));
const deviceIdentity = vi.hoisted(() => ({
	ensureDeviceIdentity: vi.fn(),
	loadStoredDeviceId: vi.fn(),
	signNonce: vi.fn(),
	storeDeviceId: vi.fn(),
}));

vi.mock('../api/auth.api.ts', () => authApi);
vi.mock('../api/deviceTrust.api.ts', () => deviceTrustApi);
vi.mock('./deviceIdentity.ts', () => deviceIdentity);

const identity = {
	type: 'Ed25519' as const,
	public: 'public-key',
	private: 'private-key',
};
const credentials = { identifier: 'mossy', password: 'correct-password' };

describe('auth flow', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		deviceIdentity.ensureDeviceIdentity.mockResolvedValue(identity);
		deviceIdentity.signNonce.mockResolvedValue('signed-nonce');
		deviceIdentity.storeDeviceId.mockResolvedValue(undefined);
	});

	it('proves possession of the stored device identity before authenticating', async () => {
		deviceIdentity.loadStoredDeviceId.mockResolvedValue('device-1');
		deviceTrustApi.executeDeviceLoginChallengeRequest.mockResolvedValue({
			status: 'challenge-ready',
			challenge: {
				nonce: 'nonce-1',
				challengeId: 'challenge-1',
				expiresAt: '2026-08-11T00:00:00Z',
			},
		});
		authApi.executeLoginRequest.mockResolvedValue({
			accessToken: 'access-token',
			accessTokenType: 'ACCESS_TOKEN',
		});

		await expect(signIn(credentials)).resolves.toEqual({
			status: 'authenticated',
			accessToken: 'access-token',
		});
		expect(deviceIdentity.signNonce).toHaveBeenCalledWith(
			'nonce-1',
			identity
		);
		expect(deviceIdentity.loadStoredDeviceId).toHaveBeenCalledWith('mossy');
		expect(authApi.executeLoginRequest).toHaveBeenCalledWith({
			...credentials,
			challengeDto: {
				deviceId: 'device-1',
				challengeId: 'challenge-1',
				signature: 'signed-nonce',
			},
		});
		expect(
			deviceTrustApi.executeCreateEnrollmentRequest
		).not.toHaveBeenCalled();
	});

	it('reports a stored device as pending without trying to sign a missing challenge', async () => {
		deviceIdentity.loadStoredDeviceId.mockResolvedValue('pending-device-1');
		deviceTrustApi.executeDeviceLoginChallengeRequest.mockResolvedValue({
			status: 'enrollment-pending',
		});

		await expect(signIn(credentials)).resolves.toEqual({
			status: 'enrollment-pending',
			deviceId: 'pending-device-1',
		});
		expect(deviceIdentity.signNonce).not.toHaveBeenCalled();
		expect(authApi.executeLoginRequest).not.toHaveBeenCalled();
	});

	it('enrolls an unknown device without treating its limited token as authentication', async () => {
		deviceIdentity.loadStoredDeviceId.mockResolvedValue(null);
		authApi.executeLoginRequest.mockResolvedValue({
			accessToken: 'enrollment-token',
			accessTokenType: 'DEVICE_ENROLLMENT_TOKEN',
		});
		deviceTrustApi.executeCreateEnrollmentRequest.mockResolvedValue({
			enrollmentId: 'enrollment-1',
			challenge: {
				nonce: 'enrollment-nonce',
				challengeId: 'enrollment-challenge',
				expiresAt: '2026-08-11T00:00:00Z',
			},
		});
		deviceTrustApi.executeConfirmEnrollmentRequest.mockResolvedValue({
			deviceId: 'pending-device-1',
		});

		await expect(signIn(credentials)).resolves.toEqual({
			status: 'enrollment-pending',
			deviceId: 'pending-device-1',
		});
		expect(authApi.executeLoginRequest).toHaveBeenCalledWith({
			...credentials,
			challengeDto: null,
		});
		expect(
			deviceTrustApi.executeConfirmEnrollmentRequest
		).toHaveBeenCalledWith(
			expect.objectContaining({
				token: 'enrollment-token',
				enrollmentId: 'enrollment-1',
				challengeId: 'enrollment-challenge',
				signature: 'signed-nonce',
			})
		);
		expect(deviceIdentity.storeDeviceId).toHaveBeenCalledWith(
			'pending-device-1',
			'mossy'
		);
	});

	it('re-enrolls when a stored device no longer exists', async () => {
		deviceIdentity.loadStoredDeviceId.mockResolvedValue('deleted-device');
		deviceTrustApi.executeDeviceLoginChallengeRequest.mockRejectedValue(
			new ApiError('Device not found', 404)
		);
		authApi.executeLoginRequest.mockResolvedValue({
			accessToken: 'enrollment-token',
			accessTokenType: 'DEVICE_ENROLLMENT_TOKEN',
		});
		deviceTrustApi.executeCreateEnrollmentRequest.mockResolvedValue({
			enrollmentId: 'replacement-enrollment',
			challenge: {
				nonce: 'replacement-nonce',
				challengeId: 'replacement-challenge',
				expiresAt: '2026-08-11T00:00:00Z',
			},
		});
		deviceTrustApi.executeConfirmEnrollmentRequest.mockResolvedValue({
			deviceId: 'replacement-device',
		});

		await expect(signIn(credentials)).resolves.toEqual({
			status: 'enrollment-pending',
			deviceId: 'replacement-device',
		});
		expect(authApi.executeLoginRequest).toHaveBeenCalledWith({
			...credentials,
			challengeDto: null,
		});
		expect(deviceIdentity.storeDeviceId).toHaveBeenCalledWith(
			'replacement-device',
			'mossy'
		);
	});

	it('registers the generated public identity and then performs challenged login', async () => {
		authApi.executeRegisterRequest.mockResolvedValue({
			deviceId: 'device-2',
		});
		deviceTrustApi.executeDeviceLoginChallengeRequest.mockResolvedValue({
			status: 'challenge-ready',
			challenge: {
				nonce: 'nonce-2',
				challengeId: 'challenge-2',
				expiresAt: '2026-08-11T00:00:00Z',
			},
		});
		authApi.executeLoginRequest.mockResolvedValue({
			accessToken: 'registered-access-token',
			accessTokenType: 'ACCESS_TOKEN',
		});

		await expect(
			registerAndSignIn({
				username: 'mossy',
				email: 'mossy@example.com',
				password: 'correct-password',
			})
		).resolves.toBe('registered-access-token');
		expect(authApi.executeRegisterRequest).toHaveBeenCalledWith({
			username: 'mossy',
			email: 'mossy@example.com',
			password: 'correct-password',
			publicIdentityKey: {
				kty: 'OKP',
				crv: 'Ed25519',
				x: 'public-key',
			},
		});
		expect(deviceIdentity.storeDeviceId).toHaveBeenCalledWith(
			'device-2',
			'mossy'
		);
		expect(deviceIdentity.storeDeviceId).toHaveBeenCalledWith(
			'device-2',
			'mossy@example.com'
		);
		expect(
			deviceTrustApi.executeDeviceLoginChallengeRequest
		).toHaveBeenCalledWith('device-2');
	});
});
