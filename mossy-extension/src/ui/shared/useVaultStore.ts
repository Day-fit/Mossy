import { create } from 'zustand';
import { messaging } from '../../messaging/rpc';
import type { Vault } from '../../types/models';
import type { AccountScope, Scope } from '../../types/vault';

type VaultStore = {
    vaultsByAccount: Record<string, Vault[]>;
    setVaults: (scope: AccountScope, vaults: Vault[]) => void;
    load: () => Promise<void>;
};

const accountKey = (scope: AccountScope) =>
    JSON.stringify([scope.instance, scope.accountId]);

// Each extension page has its own store. Only vault metadata is cached here.
export const useVaultStore = create<VaultStore>((set, get) => ({
    vaultsByAccount: {},
    setVaults: (scope, vaults) =>
        set((state) => ({
            vaultsByAccount: {
                ...state.vaultsByAccount,
                [accountKey(scope)]: vaults,
            },
        })),
    load: async () => {
        const { scope, vaults } = await messaging.sendMessage('getVaults');
        get().setVaults(scope, vaults);
    },
}));

export function selectVaultName(state: VaultStore, scope: Scope): string {
    return (
        state.vaultsByAccount[accountKey(scope)]
            ?.find((vault) => vault.vaultId === scope.vaultId)
            ?.vaultName.trim() || scope.vaultId
    );
}
