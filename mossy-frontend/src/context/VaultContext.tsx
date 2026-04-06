import {
	executeUserVaultsRequest,
	type UserVaultDto,
} from '../api/vault.api.ts';
import { createContext, useContext, useEffect, useState } from 'react';
import * as React from 'react';

type VaultContextState = {
	vaults: UserVaultDto[];
};

export const VaultContext = createContext<VaultContextState | null>(null);

export function VaultProvider({ children }: { children: React.ReactNode }) {
	const [vaults, setVaults] = useState<UserVaultDto[]>([]);

	const loadVaults = async () => {
		const vaults = await executeUserVaultsRequest();
		setVaults(vaults);
	};

	useEffect(() => {
		void loadVaults();
	}, []);

	return (
		<VaultContext.Provider value={{ vaults }}>
			{children}
		</VaultContext.Provider>
	);
}

export function useVault(): VaultContextState {
	const ctx = useContext(VaultContext);

	if (!ctx) {
		throw new Error('useVault must be used within a VaultProvider');
	}

	return ctx;
}
