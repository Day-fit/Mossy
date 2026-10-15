import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import DashboardHero from './DashboardHero.tsx';
import { useVaultStore } from '../../store/vaultStore.ts';

const { getKey, statisticsResult } = vi.hoisted(() => ({
    getKey: vi.fn(),
    statisticsResult: {
        statistics: { totalPasswords: 0, passwordChart: [], recentActions: [] },
        isLoading: false,
        error: null as string | null,
        reload: vi.fn(),
    },
}));

vi.mock('../../auth/deviceIdentity.ts', () => ({
    getDeviceDatabase: async () => ({ get: getKey }),
}));
vi.mock('../../hooks/useDashboardStatistics.ts', () => ({
    useDashboardStatistics: () => statisticsResult,
}));
vi.mock('recharts', async (importOriginal) => ({
    ...(await importOriginal<typeof import('recharts')>()),
    ResponsiveContainer: () => null,
}));

beforeEach(() => {
    getKey.mockReset();
    statisticsResult.statistics.totalPasswords = 0;
    statisticsResult.isLoading = false;
    statisticsResult.error = null;
    useVaultStore.setState({
        vaults: [],
        selectedVaultId: '',
        isLoading: false,
        errorOccurred: false,
    });
});
afterEach(cleanup);

function renderDashboard() {
    return render(
        <MemoryRouter>
            <DashboardHero />
        </MemoryRouter>
    );
}

it('guides an empty account to all three setup pages', async () => {
    renderDashboard();
    expect(await screen.findByText('0 of 3 steps complete')).toBeTruthy();
    for (const [name, href] of [
        ['Install your vault', '/vaults'],
        ['Sync key', '/key-sync'],
        ['Add your first password', '/passwords'],
    ]) {
        expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(
            href
        );
    }
    expect(screen.queryByText('No password history yet.')).toBeNull();
});

it.each([false, true])(
    'reflects vault and key progress (stored key: %s)',
    async (hasKey) => {
        useVaultStore.setState({
            vaults: [
                {
                    vaultId: 'vault-1',
                    vaultName: 'Personal',
                    isOnline: true,
                    passwordCount: 0,
                    lastSeenAt: null,
                },
            ],
        });
        getKey.mockResolvedValue(
            hasKey
                ? { wrappedKey: new Uint8Array([1]), salt: new Uint8Array([2]) }
                : undefined
        );
        renderDashboard();
        expect(
            await screen.findByText(`${hasKey ? 2 : 1} of 3 steps complete`)
        ).toBeTruthy();
        expect(
            (screen.getByRole('progressbar') as HTMLProgressElement).value
        ).toBe(hasKey ? 2 : 1);
    }
);

it.each(['passwords', 'loading', 'statistics error', 'vault error'])(
    'keeps the normal dashboard for %s',
    (state) => {
        if (state === 'passwords')
            statisticsResult.statistics.totalPasswords = 1;
        if (state === 'loading') statisticsResult.isLoading = true;
        if (state === 'statistics error')
            statisticsResult.error = 'Network error';
        if (state === 'vault error')
            useVaultStore.setState({ errorOccurred: true });
        renderDashboard();
        expect(screen.queryByText('Get started with Mossy')).toBeNull();
        expect(
            screen.getByRole('heading', { name: 'Recent actions' })
        ).toBeTruthy();
    }
);
