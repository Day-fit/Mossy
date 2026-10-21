import { tokenStorage } from '../auth/tokenStorage.ts';

type ApiFetchOptions = RequestInit & {
    includeAuth?: boolean;
    authToken?: string | null;
};

export class ApiError extends Error {
    readonly status: number;
    readonly code?: string;
    readonly retryAfter?: number;

    constructor(
        message: string,
        status: number,
        code?: string,
        retryAfter?: number
    ) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
        this.retryAfter = retryAfter;
    }
}

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
        throw new ApiError(
            error?.message || 'An error occurred',
            response.status,
            error?.code,
            response.headers.has('Retry-After')
                ? Number(response.headers.get('Retry-After'))
                : undefined
        );
    }

    return response;
}
