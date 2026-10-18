import { useAuthStore } from '../../store/authStore.ts';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { vaultKeyId } from '../../storage/keyIds.ts';
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
    useAuthStore.setState({
        isAuthenticated: true,
        userDetails: {
            userId: 'user-one',
            email: 'one@example.test',
            username: 'One',
            grantedAuthorities: [],
        },
    });

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
    expect(
        screen
            .getByRole('link', { name: 'Install your vault' })
            .getAttribute('aria-current')
    ).toBe('step');
});

it.each(['none', 'PRF', 'Text'] as const)(
    'reflects vault and key progress (stored key: %s)',
    async (keyType) => {
        const hasKey = keyType !== 'none';
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
                ? {
                      type: keyType,
                      credentialId: 'Y3JlZA',
                      prfSalt: new Uint8Array(32),
                      wrappedKey: new Uint8Array([1]).buffer,
                      salt: new Uint8Array([2]),
                  }
                : undefined
        );
        renderDashboard();
        expect(
            await screen.findByText(`${hasKey ? 2 : 1} of 3 steps complete`)
        ).toBeTruthy();
        expect(getKey).toHaveBeenCalledWith(
            'keys',
            vaultKeyId('user-one', 'vault-1')
        );
        expect(
            (screen.getByRole('progressbar') as HTMLProgressElement).value
        ).toBe(hasKey ? 2 : 1);
        expect(
            screen
                .getByRole('link', {
                    name: hasKey ? 'Add your first password' : 'Sync key',
                })
                .getAttribute('aria-current')
        ).toBe('step');
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
