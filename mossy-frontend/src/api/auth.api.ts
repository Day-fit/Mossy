import { apiFetch } from './client.ts';

export type UserDetailsResponse = {
	userId: string;
	username: string;
	email: string;
	grantedAuthorities: string[];
};

export async function executeRegisterRequest(data: {
	username: string;
	email: string;
	password: string;
}) {
	try {
		return await apiFetch('/api/v1/auth/register', {
			includeAuth: false,
			method: 'POST',
			body: JSON.stringify(data),
		});
	} catch (e) {
		throw e;
	}
}

export async function executeLoginRequest(data: {
	identifier: string;
	password: string;
}) {
	try {
		return await apiFetch('/api/v1/auth/login', {
			includeAuth: false,
			method: 'POST',
			body: JSON.stringify(data),
		});
	} catch (e) {
		throw e;
	}
}

export async function executeCheckAuthState(data: { token: string }) {
	try {
		return await apiFetch('/api/v1/auth/status', {
			method: 'GET',
			authToken: data.token,
		});
	} catch (e) {
		throw e;
	}
}

export async function executeUserDetailsRequest() {
	try {
		return (await apiFetch('/api/v1/auth/user/details', {
			method: 'GET',
		}).then((res) => res.json())) as UserDetailsResponse;
	} catch (e) {
		throw e;
	}
}

export async function executeConfirmEmailRequest(token: string) {
	try {
		return await apiFetch(`/api/v1/auth/user/confirm/${token}`, {
			includeAuth: false,
			method: 'GET',
		});
	} catch (e) {
		throw e;
	}
}

export async function executeRefreshRequest() {
	try {
		return await apiFetch('/api/v1/auth/refresh', {
			includeAuth: false,
			method: 'POST',
		});
	} catch (e) {
		throw e;
	}
}
