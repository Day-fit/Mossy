import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, setAuthRefreshHandler } from './client';
import { tokenStorage } from '../auth/tokenStorage';

const fetchMock = vi.fn<typeof fetch>();
const expired = () =>
    new Response(JSON.stringify({ message: 'Expired' }), { status: 401 });
const ok = () => new Response(JSON.stringify({ saved: true }), { status: 200 });

beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    tokenStorage.set('expired-access-token');
    setAuthRefreshHandler(undefined);
});
afterEach(() => {
    setAuthRefreshHandler(undefined);
    tokenStorage.set(null);
    vi.unstubAllGlobals();
});

describe('opt-in authenticated request refresh', () => {
    it('refreshes and retries a protected write once with its original body', async () => {
        fetchMock.mockResolvedValueOnce(expired()).mockResolvedValueOnce(ok());
        const refresh = vi.fn(async () => {
            tokenStorage.set('fresh-access-token');
        });
        setAuthRefreshHandler(refresh);
        const body = JSON.stringify({ ciphertext: 'encrypted-fixture' });
        await expect(
            apiFetch('/passwords/save', { method: 'POST', body })
        ).resolves.toHaveProperty('status', 200);
        expect(refresh).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenNthCalledWith(
            1,
            '/passwords/save',
            expect.objectContaining({
                method: 'POST',
                body,
                headers: expect.objectContaining({
                    Authorization: 'Bearer expired-access-token',
                }),
            })
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            '/passwords/save',
            expect.objectContaining({
                method: 'POST',
                body,
                headers: expect.objectContaining({
                    Authorization: 'Bearer fresh-access-token',
                }),
            })
        );
    });

    it('shares one refresh for simultaneous 401 responses', async () => {
        fetchMock.mockImplementation(async (_url, options) =>
            (options?.headers as Record<string, string>).Authorization ===
            'Bearer expired-access-token'
                ? expired()
                : ok()
        );
        const refresh = vi.fn(async () => {
            await Promise.resolve();
            tokenStorage.set('fresh-access-token');
        });
        setAuthRefreshHandler(refresh);
        await Promise.all([apiFetch('/vaults'), apiFetch('/user')]);
        expect(refresh).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it('uses an already-refreshed token when another old request returns 401 late', async () => {
        let rejectOld!: (response: Response) => void;
        fetchMock
            .mockResolvedValueOnce(expired())
            .mockReturnValueOnce(
                new Promise((resolve) => {
                    rejectOld = resolve;
                })
            )
            .mockResolvedValue(ok());
        const refresh = vi.fn(async () => {
            tokenStorage.set('fresh-access-token');
        });
        setAuthRefreshHandler(refresh);
        const first = apiFetch('/first');
        const late = apiFetch('/late');
        await first;
        rejectOld(expired());
        await late;
        expect(refresh).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it('does not retry protected requests when refreshing fails', async () => {
        fetchMock.mockResolvedValue(expired());
        const failure = new Error('Refresh session expired');
        const refresh = vi.fn().mockRejectedValue(failure);
        setAuthRefreshHandler(refresh);
        await expect(apiFetch('/vaults')).rejects.toBe(failure);
        expect(refresh).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('stops after one refresh if the retried token is also rejected', async () => {
        fetchMock.mockResolvedValue(expired());
        const refresh = vi.fn(async () => {
            tokenStorage.set('fresh-access-token');
        });
        setAuthRefreshHandler(refresh);
        await expect(apiFetch('/vaults')).rejects.toMatchObject({
            status: 401,
        });
        expect(refresh).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not refresh login, refresh-cookie or explicitly authenticated enrollment requests', async () => {
        fetchMock.mockResolvedValue(expired());
        const refresh = vi.fn();
        setAuthRefreshHandler(refresh);
        await expect(
            apiFetch('/login', { includeAuth: false })
        ).rejects.toMatchObject({ status: 401 });
        await expect(
            apiFetch('/refresh', { includeAuth: false })
        ).rejects.toMatchObject({ status: 401 });
        await expect(
            apiFetch('/enroll', { authToken: 'enrollment-token' })
        ).rejects.toMatchObject({ status: 401 });
        expect(refresh).not.toHaveBeenCalled();
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('preserves existing behavior when no refresh handler is configured', async () => {
        fetchMock.mockResolvedValue(expired());
        await expect(apiFetch('/vaults')).rejects.toMatchObject({
            status: 401,
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not refresh forbidden requests', async () => {
        fetchMock.mockResolvedValue(
            new Response(JSON.stringify({ message: 'Forbidden' }), {
                status: 403,
            })
        );
        const refresh = vi.fn();
        setAuthRefreshHandler(refresh);
        await expect(apiFetch('/vaults')).rejects.toMatchObject({
            status: 403,
        });
        expect(refresh).not.toHaveBeenCalled();
    });
});
