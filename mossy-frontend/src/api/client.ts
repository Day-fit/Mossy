import { tokenStorage } from '../auth/tokenStorage.ts';

type ApiFetchOptions = RequestInit & {
	includeAuth?: boolean;
	authToken?: string | null;
};

export async function apiFetch(url: string, options: ApiFetchOptions = {}) {
	const { includeAuth = true, authToken, ...requestOptions } = options;
	const token = includeAuth ? (authToken ?? tokenStorage.get()) : null;

	const response = await fetch(url, {
		...requestOptions,
		headers: {
			...requestOptions.headers,
			'Content-Type': 'application/json',
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},

		credentials: 'include',
	});

	if (!response.ok) {
		const error = await response.json().catch(() => null);
		throw new Error(error?.message || 'An error occurred');
	}

	return response;
}
