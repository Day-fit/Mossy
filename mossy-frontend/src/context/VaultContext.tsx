import {
	executeUserVaultsRequest,
	type UserVaultDto,
} from '../api/vault.api.ts';
import { createContext, useContext, useEffect, useState } from 'react';
import * as React from 'react';

type VaultContextState = {
	vaults: UserVaultDto[];
	refreshVaults: () => Promise<void>;
	isLoading: boolean;
	errorOccurred: boolean;
};

export const VaultContext = createContext<VaultContextState | null>(null);

export function VaultProvider({ children }: { children: React.ReactNode }) {
	const [vaults, setVaults] = useState<UserVaultDto[]>([]);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [errorOccurred, setErrorOccurred] = useState<boolean>(false);

	const loadVaults = async () => {
		try {
			setIsLoading(true);
			const result = await executeUserVaultsRequest();
			setVaults(result);
			setErrorOccurred(false);
		} catch (error) {
			setErrorOccurred(true);
		} finally {
			setIsLoading(false);
		}
	};

	const refreshVaults = async () => {
		await loadVaults();
		const channel = new BroadcastChannel('vault_updates');
		channel.postMessage('refresh');
		channel.close();
	};

	useEffect(() => {
		void loadVaults();

		const bc = new BroadcastChannel('vault_updates');
		bc.onmessage = (event) => {
			if (event.data === 'refresh') {
				void loadVaults();
			}
		};

		return () => {
			bc.close();
		};
	}, []);

	return (
		<VaultContext.Provider
			value={{ vaults, refreshVaults, isLoading, errorOccurred }}
		>
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
