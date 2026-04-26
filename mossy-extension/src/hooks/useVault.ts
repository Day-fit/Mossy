import { useCallback } from 'react';
import { executeUserVaultsRequest } from '../api/vault.api';
import { useVaultStore } from '../store/vaultStore';

export function useVault() {
  const vaults = useVaultStore((state) => state.vaults);
  const selectedVaultId = useVaultStore((state) => state.selectedVaultId);
  const setVaults = useVaultStore((state) => state.setVaults);
  const setSelectedVaultId = useVaultStore((state) => state.setSelectedVaultId);

  const refreshVaults = useCallback(async () => {
    const result = await executeUserVaultsRequest();
    setVaults(result);

    if (!selectedVaultId) {
      const firstOnline = result.find((vault) => vault.isOnline) ?? result[0];
      if (firstOnline) setSelectedVaultId(firstOnline.vaultId);
      return;
    }

    if (!result.some((vault) => vault.vaultId === selectedVaultId)) {
      setSelectedVaultId('');
    }
  }, [selectedVaultId, setSelectedVaultId, setVaults]);

  return { vaults, selectedVaultId, setSelectedVaultId, refreshVaults };
}
