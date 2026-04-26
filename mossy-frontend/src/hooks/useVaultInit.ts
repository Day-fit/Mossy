import { useCallback, useEffect } from 'react';
import { executeUserVaultsRequest } from '../api/vault.api.ts';
import { useVaultStore } from '../store/vaultStore.ts';
import { useAuthStore } from '../store/authStore.ts';

export function useVaultInit() {
	const setVaults = useVaultStore((state) => state.setVaults);
	const setIsLoading = useVaultStore((state) => state.setIsLoading);
	const setErrorOccurred = useVaultStore((state) => state.setErrorOccurred);
	const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

	const loadVaults = useCallback(async () => {
		try {
			setIsLoading(true);
			const result = await executeUserVaultsRequest();
			setVaults(result);
			setErrorOccurred(false);
		} catch {
			setErrorOccurred(true);
		} finally {
			setIsLoading(false);
		}
	}, [setErrorOccurred, setIsLoading, setVaults]);

	useEffect(() => {
		if (!isAuthenticated) return;

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
	}, [loadVaults, isAuthenticated]);
}
