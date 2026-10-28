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

// Opt-in for clients that own an authenticated session, such as the extension.
let authRefreshHandler: (() => Promise<void>) | undefined;
let refreshing: Promise<void> | undefined;

export function setAuthRefreshHandler(
    handler: (() => Promise<void>) | undefined
) {
    authRefreshHandler = handler;
}

export async function apiFetch(url: string, options: ApiFetchOptions = {}) {
    const { includeAuth = true, authToken, ...requestOptions } = options;
    const token = includeAuth ? (authToken ?? tokenStorage.get()) : null;

    const send = (accessToken: string | null) =>
        fetch(url, {
            ...requestOptions,
            headers: {
                ...requestOptions.headers,
                'Content-Type': 'application/json',
                ...(accessToken
                    ? { Authorization: `Bearer ${accessToken}` }
                    : {}),
            },

            credentials: 'include',
        });

    let response = await send(token);
    const refresh = authRefreshHandler;
    if (
        response.status === 401 &&
        includeAuth &&
        authToken === undefined &&
        token &&
        refresh
    ) {
        // A concurrent request may already have refreshed this access token.
        if (tokenStorage.get() === token) {
            refreshing ??= Promise.resolve()
                .then(refresh)
                .finally(() => {
                    refreshing = undefined;
                });
            await refreshing;
        }
        const currentToken = tokenStorage.get();
        if (currentToken) response = await send(currentToken);
    }

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
