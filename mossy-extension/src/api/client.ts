import { tokenStorage } from '../auth/tokenStorage';

type ApiFetchOptions = RequestInit & {
  includeAuth?: boolean;
  authToken?: string | null;
  includeCredentials?: boolean;
};

export async function apiFetch(url: string, options: ApiFetchOptions = {}) {
  const { includeAuth = true, authToken, includeCredentials = false, ...requestOptions } = options;
  const token = includeAuth ? (authToken ?? await tokenStorage.get()) : null;

  const response = await fetch(url, {
    ...requestOptions,
    headers: {
      ...requestOptions.headers,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: includeCredentials ? 'include' : 'omit',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || 'Request failed');
  }

  return response;
}
