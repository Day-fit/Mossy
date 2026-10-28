import { beforeEach, describe, expect, it, vi } from 'vitest';
import { selectVaultName, useVaultStore } from './useVaultStore';

const { sendMessage } = vi.hoisted(() => ({ sendMessage: vi.fn() }));

vi.mock('../../messaging/rpc', () => ({ messaging: { sendMessage } }));

const scope = {
    instance: 'https://mossy.test',
    accountId: 'alice',
    vaultId: 'vault',
};

beforeEach(() => {
    vi.resetAllMocks();
    useVaultStore.setState({ vaultsByAccount: {} });
});

describe('UI vault metadata', () => {
    it('fetches metadata and looks up names without mixing accounts or instances', async () => {
        sendMessage.mockResolvedValue({
            scope,
            vaults: [{ vaultId: 'vault', vaultName: 'Personal' }],
        });
        await useVaultStore.getState().load();

        expect(sendMessage).toHaveBeenCalledWith('getVaults');
        const state = useVaultStore.getState();
        expect(selectVaultName(state, scope)).toBe('Personal');
        expect(selectVaultName(state, { ...scope, accountId: 'bob' })).toBe(
            'vault'
        );
        expect(
            selectVaultName(state, {
                ...scope,
                instance: 'https://other.test',
            })
        ).toBe('vault');
    });

    it('refreshes renamed vaults and falls back to IDs for removed or unnamed vaults', () => {
        const { setVaults } = useVaultStore.getState();
        setVaults(scope, [{ vaultId: 'vault', vaultName: 'Personal' }]);
        setVaults(scope, [{ vaultId: 'vault', vaultName: 'Work' }]);
        expect(selectVaultName(useVaultStore.getState(), scope)).toBe('Work');

        setVaults(scope, [{ vaultId: 'vault', vaultName: '   ' }]);
        expect(selectVaultName(useVaultStore.getState(), scope)).toBe('vault');

        setVaults(scope, []);
        expect(selectVaultName(useVaultStore.getState(), scope)).toBe('vault');
    });

    it('keeps the ID fallback when metadata cannot be fetched', async () => {
        sendMessage.mockRejectedValue(new Error('Offline'));
        await expect(useVaultStore.getState().load()).rejects.toThrow('Offline');
        expect(selectVaultName(useVaultStore.getState(), scope)).toBe('vault');
    });
});
