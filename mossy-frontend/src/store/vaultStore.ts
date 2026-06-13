import { create } from 'zustand';
import type { UserVaultDto } from '../api/vault.api.ts';

type VaultStoreState = {
	vaults: UserVaultDto[];
	selectedVaultId: string;
	isLoading: boolean;
	errorOccurred: boolean;
	setSelectedVaultId: (value: string | undefined) => void;
	setVaults: (value: UserVaultDto[]) => void;
	setIsLoading: (value: boolean) => void;
	setErrorOccurred: (value: boolean) => void;
};

export const useVaultStore = create<VaultStoreState>((set) => ({
	vaults: [],
	selectedVaultId: '',
	isLoading: true,
	errorOccurred: false,
	setSelectedVaultId: (value) => set({ selectedVaultId: value }),
	setVaults: (value) => set({ vaults: value }),
	setIsLoading: (value) => set({ isLoading: value }),
	setErrorOccurred: (value) => set({ errorOccurred: value }),
}));
