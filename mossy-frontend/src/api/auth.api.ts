import { apiFetch } from './client.ts';

export type UserDetailsResponse = {
	userId: string;
	username: string;
	email: string | null;
	grantedAuthorities: string[];
};

export type PublicIdentityJwk = {
	kty: 'OKP';
	crv: 'Ed25519';
	x: string;
};

export type LoginChallenge = {
	deviceId: string;
	challengeId: string;
	signature: string;
};

export type LoginResponse = {
	accessToken: string;
	accessTokenType: 'ACCESS_TOKEN' | 'DEVICE_ENROLLMENT_TOKEN';
};

export async function executeRegisterRequest(data: {
	username: string;
	email: string;
	password: string;
	publicIdentityKey: PublicIdentityJwk;
}): Promise<{ deviceId: string }> {
	return apiFetch('/api/v1/auth/register', {
		includeAuth: false,
		method: 'POST',
		body: JSON.stringify(data),
	}).then((response) => response.json());
}

export async function executeLoginRequest(data: {
	identifier: string;
	password: string;
	challengeDto: LoginChallenge | null;
}): Promise<LoginResponse> {
	return apiFetch('/api/v1/auth/login', {
		includeAuth: false,
		method: 'POST',
		body: JSON.stringify(data),
	}).then((response) => response.json());
}

export async function executeCheckAuthState(data: { token: string }) {
	return apiFetch('/api/v1/auth/status', {
		method: 'GET',
		authToken: data.token,
	});
}

export async function executeUserDetailsRequest() {
	return apiFetch('/api/v1/auth/user/me', {
		method: 'GET',
	}).then((response) => response.json() as Promise<UserDetailsResponse>);
}

export async function executeConfirmEmailRequest(token: string) {
	return apiFetch(`/api/v1/auth/user/confirm/${token}`, {
		includeAuth: false,
		method: 'GET',
	});
}

export async function executeRefreshRequest() {
	return apiFetch('/api/v1/auth/refresh', {
		includeAuth: false,
		method: 'POST',
	});
}

export async function executeLogoutRequest(): Promise<void> {
	await apiFetch('/api/v1/auth/logout', {
		includeAuth: false,
		method: 'POST',
	});
}
