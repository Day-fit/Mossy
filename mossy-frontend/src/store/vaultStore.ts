import { create } from 'zustand';
import {
	executeUserVaultsRequest,
	type UserVaultDto,
} from '../api/vault.api.ts';

type VaultStoreState = {
	vaults: UserVaultDto[];
	selectedVaultId: string;
	isLoading: boolean;
	errorOccurred: boolean;
	setSelectedVaultId: (value: string | undefined) => void;
	setVaults: (value: UserVaultDto[]) => void;
	setIsLoading: (value: boolean) => void;
	setErrorOccurred: (value: boolean) => void;
	loadVaults: () => Promise<void>;
	refreshVaults: () => Promise<void>;
};

export const useVaultStore = create<VaultStoreState>((set, get) => ({
	vaults: [],
	selectedVaultId: '',
	isLoading: true,
	errorOccurred: false,
	setSelectedVaultId: (value) => set({ selectedVaultId: value }),
	setVaults: (value) => set({ vaults: value }),
	setIsLoading: (value) => set({ isLoading: value }),
	setErrorOccurred: (value) => set({ errorOccurred: value }),
	loadVaults: async () => {
		try {
			set({ isLoading: true });
			const vaults = await executeUserVaultsRequest();
			set({ vaults, errorOccurred: false });
		} catch {
			set({ errorOccurred: true });
		} finally {
			set({ isLoading: false });
		}
	},
	refreshVaults: async () => {
		await get().loadVaults();
		const channel = new BroadcastChannel('vault_updates');
		channel.postMessage('refresh');
		channel.close();
	},
}));
