import { create } from 'zustand';
import type { UserVaultDto } from '../types';

type VaultStoreState = {
  vaults: UserVaultDto[];
  selectedVaultId: string;
  setVaults: (value: UserVaultDto[]) => void;
  setSelectedVaultId: (value: string) => void;
};

export const useVaultStore = create<VaultStoreState>((set) => ({
  vaults: [],
  selectedVaultId: '',
  setVaults: (value) => set({ vaults: value }),
  setSelectedVaultId: (value) => set({ selectedVaultId: value }),
}));
