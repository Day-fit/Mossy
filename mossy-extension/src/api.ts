import { ApiError, type Transport } from '@mossy/client-core';
export class ExtensionTransport implements Transport {
    private accessToken: string | null = null;
    private revision = 0;
    get token() {
        return this.accessToken;
    }
    set token(value: string | null) {
        this.revision++;
        this.accessToken = value;
    }
    private refreshing?: Promise<void>;
    constructor(
        readonly instance: string,
        private invalidated: () => void
    ) {}
    async request<T>(
        path: string,
        options: RequestInit & {
            token?: string;
            anonymous?: boolean;
            beforeDispatch?: () => void;
        } = {}
    ): Promise<T> {
        if (
            !path.startsWith('/api/v1/') ||
            path.startsWith('//') ||
            new URL(path, this.instance).origin !== this.instance
        )
            throw new Error('Invalid API destination.');
        const { token, anonymous, beforeDispatch, ...init } = options;
        const revision = this.revision;
        const current = () => {
            if (revision !== this.revision) throw new Error('Session changed.');
        };
        const dispatch = () => {
            current();
            beforeDispatch?.();
            return fetch(new URL(path, this.instance), {
                ...init,
                redirect: 'error',
                credentials: path.startsWith('/api/v1/auth/extension/')
                    ? 'include'
                    : 'omit',
                headers: {
                    'Content-Type': 'application/json',
                    ...init.headers,
                    ...((token ?? (!anonymous && this.token))
                        ? { Authorization: `Bearer ${token ?? this.token}` }
                        : {}),
                },
            });
        };
        let response = await dispatch();
        current();
        if (response.status === 401 && !anonymous && !token) {
            await this.refresh();
            response = await dispatch();
            current();
        }
        if (!response.ok) {
            if (
                [404, 405].includes(response.status) &&
                path.startsWith('/api/v1/auth/extension/')
            )
                throw new Error(
                    'Upgrade required: this Mossy server does not support extension authentication.'
                );
            const error = await response.json().catch(() => ({}));
            current();
            if ([401, 403].includes(response.status) && !anonymous && !token) {
                this.token = null;
                this.invalidated();
            }
            throw new ApiError(
                error.message || `Request failed (${response.status}).`,
                response.status,
                error.code
            );
        }
        if (response.status === 204 || response.status === 202)
            return null as T;
        const text = await response.text();
        current();
        return (text ? JSON.parse(text) : null) as T;
    }
    async receiverEvents(signal: AbortSignal): Promise<Response> {
        const dispatch = () =>
            fetch(new URL('/api/v1/key-sync/receiver-events', this.instance), {
                headers: {
                    Accept: 'text/event-stream',
                    Authorization: `Bearer ${this.token}`,
                },
                credentials: 'omit',
                redirect: 'error',
                signal,
            });
        let response = await dispatch();
        if (response.status === 401) {
            await this.refresh();
            response = await dispatch();
        }
        if (
            !response.ok ||
            !response.headers
                .get('Content-Type')
                ?.includes('text/event-stream') ||
            !response.body
        )
            throw new Error('The key sync event stream is unavailable.');
        return response;
    }
    async refresh(): Promise<void> {
        const revision = this.revision;
        if (!this.refreshing)
            this.refreshing = this.request<{ accessToken: string }>(
                '/api/v1/auth/extension/refresh',
                { method: 'POST', anonymous: true }
            )
                .then((result) => {
                    if (!result?.accessToken)
                        throw new Error('Sign in to Mossy.');
                    if (revision !== this.revision)
                        throw new Error('Session changed.');
                    this.accessToken = result.accessToken;
                })
                .catch((error) => {
                    if (revision === this.revision) {
                        this.token = null;
                        this.invalidated();
                    }
                    throw error;
                })
                .finally(() => {
                    this.refreshing = undefined;
                });
        return this.refreshing;
    }
}
