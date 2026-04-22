import { create } from 'zustand';
import type { UserVaultDto } from '../api/vault.api.ts';

type VaultStoreState = {
vaults: UserVaultDto[];
isLoading: boolean;
errorOccurred: boolean;
setVaults: (value: UserVaultDto[]) => void;
setIsLoading: (value: boolean) => void;
setErrorOccurred: (value: boolean) => void;
};

export const useVaultStore = create<VaultStoreState>((set) => ({
vaults: [],
isLoading: true,
errorOccurred: false,
setVaults: (value) => set({ vaults: value }),
setIsLoading: (value) => set({ isLoading: value }),
setErrorOccurred: (value) => set({ errorOccurred: value }),
}));
