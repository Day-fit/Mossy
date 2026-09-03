import { useEffect } from 'react';
import { useVaultStore } from '../store/vaultStore.ts';
import { useAuthStore } from '../store/authStore.ts';

export function useVaultInit() {
	const loadVaults = useVaultStore((state) => state.loadVaults);
	const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

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
