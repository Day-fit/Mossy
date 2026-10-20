import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExtensionTransport } from './api';

afterEach(() => vi.unstubAllGlobals());

const json = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

describe('isolated extension transport', () => {
    it.each([200, 401, 403])(
        'rejects stale API responses without clearing a replacement account (%s)',
        async (status) => {
            let release: (value: Response) => void = () => {};

            vi.stubGlobal(
                'fetch',
                vi.fn(
                    () =>
                        new Promise<Response>((resolve) => {
                            release = resolve;
                        })
                )
            );

            const invalidated = vi.fn();
            const api = new ExtensionTransport(
                'https://vault.example',
                invalidated
            );
            api.token = 'old-account';

            const result = api.request('/api/v1/passwords/metadata');
            api.token = 'replacement-account';
            release(json({}, status));

            await expect(result).rejects.toThrow('Session changed');

            expect(api.token).toBe('replacement-account');
            expect(invalidated).not.toHaveBeenCalled();
        }
    );
    it('resolves only instance API paths, rejects redirects and sends cookies only to extension auth', async () => {
        const fetch = vi
            .fn()
            .mockImplementation(() => Promise.resolve(json({})));
        vi.stubGlobal('fetch', fetch);

        const api = new ExtensionTransport('https://vault.example', () => {});
        api.token = 'in-memory';

        await api.request('/api/v1/passwords/metadata');
        await api.request('/api/v1/auth/extension/logout', {
            method: 'POST',
            anonymous: true,
        });

        expect(String(fetch.mock.calls[0]![0])).toBe(
            'https://vault.example/api/v1/passwords/metadata'
        );
        expect(fetch.mock.calls[0]![1]).toMatchObject({
            credentials: 'omit',
            redirect: 'error',
            headers: { Authorization: 'Bearer in-memory' },
        });
        expect(fetch.mock.calls[1]![1].credentials).toBe('include');

        for (const path of [
            'https://evil.example/api/v1/x',
            '//evil.example/x',
            '/not-api',
        ]) {
            await expect(api.request(path)).rejects.toThrow('destination');
        }
    });
    it('shares concurrent refresh requests and never uses the web cookie routes', async () => {
        let release: (value: Response) => void = () => {};

        const fetch = vi.fn().mockImplementation(
            () =>
                new Promise<Response>((resolve) => {
                    release = resolve;
                })
        );
        vi.stubGlobal('fetch', fetch);

        const api = new ExtensionTransport('https://vault.example', () => {});
        const a = api.refresh();
        const b = api.refresh();

        expect(fetch).toHaveBeenCalledTimes(1);
        release(json({ accessToken: 'new-token' }));

        await Promise.all([a, b]);

        expect(api.token).toBe('new-token');
        expect(String(fetch.mock.calls[0]![0])).toContain(
            '/auth/extension/refresh'
        );
    });
    it('reports missing extension routes as upgrade required without web fallback', async () => {
        const fetch = vi.fn().mockResolvedValue(json({}, 404));
        vi.stubGlobal('fetch', fetch);

        const api = new ExtensionTransport('https://vault.example', () => {});

        await expect(api.refresh()).rejects.toThrow('Upgrade required');

        expect(fetch).toHaveBeenCalledTimes(1);
    });
    it('rechecks deadline/account authorization before a refreshed retry and permits an already-dispatched response to complete late', async () => {
        let now = 0;
        const fetch = vi.fn().mockImplementation((url: URL) => {
            if (url.pathname.endsWith('/refresh')) {
                now = 10000;

                return Promise.resolve(json({ accessToken: 'renewed' }));
            }

            return Promise.resolve(json({}, 401));
        });
        vi.stubGlobal('fetch', fetch);

        const api = new ExtensionTransport('https://vault.example', () => {});
        api.token = 'expired';

        await expect(
            api.request('/api/v1/passwords/save', {
                method: 'POST',
                beforeDispatch: () => {
                    if (now >= 10000) {
                        throw new Error('Expired');
                    }
                },
            })
        ).rejects.toThrow('Expired');

        expect(
            fetch.mock.calls.filter(([url]) =>
                (url as URL).pathname.endsWith('/save')
            )
        ).toHaveLength(1);
        now = 0;
        fetch.mockImplementation(() => {
            now = 10000;

            return Promise.resolve(json({ message: 'Saved' }));
        });

        expect(
            await api.request('/api/v1/passwords/save', {
                method: 'POST',
                beforeDispatch: () => {
                    if (now >= 10000) {
                        throw new Error('Expired');
                    }
                },
            })
        ).toEqual({ message: 'Saved' });
    });
    it('does not resurrect or clear a replacement account when an older refresh completes', async () => {
        let release: (value: Response) => void = () => {};

        const fetch = vi.fn().mockImplementation(
            () =>
                new Promise<Response>((resolve) => {
                    release = resolve;
                })
        );
        vi.stubGlobal('fetch', fetch);

        const invalidated = vi.fn();
        const api = new ExtensionTransport(
            'https://vault.example',
            invalidated
        );
        api.token = 'old';

        const refresh = api.refresh();
        api.token = null;
        api.token = 'new-account';
        release(json({ accessToken: 'stale' }));

        await expect(refresh).rejects.toThrow('Session changed');

        expect(api.token).toBe('new-account');
        expect(invalidated).not.toHaveBeenCalled();
    });
});
