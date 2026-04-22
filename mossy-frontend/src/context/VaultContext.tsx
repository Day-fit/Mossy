import {
executeUserVaultsRequest,
type UserVaultDto,
} from '../api/vault.api.ts';
import { useCallback, useEffect } from 'react';
import * as React from 'react';
import { useVaultStore } from '../store/vaultStore.ts';

type VaultContextState = {
vaults: UserVaultDto[];
refreshVaults: () => Promise<void>;
isLoading: boolean;
errorOccurred: boolean;
};

export function VaultProvider({ children }: { children: React.ReactNode }) {
const setVaults = useVaultStore((state) => state.setVaults);
const setIsLoading = useVaultStore((state) => state.setIsLoading);
const setErrorOccurred = useVaultStore((state) => state.setErrorOccurred);

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
}, [loadVaults]);

return children;
}

export function useVault(): VaultContextState {
const vaults = useVaultStore((state) => state.vaults);
const isLoading = useVaultStore((state) => state.isLoading);
const errorOccurred = useVaultStore((state) => state.errorOccurred);
const setVaults = useVaultStore((state) => state.setVaults);
const setIsLoading = useVaultStore((state) => state.setIsLoading);
const setErrorOccurred = useVaultStore((state) => state.setErrorOccurred);

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

const refreshVaults = useCallback(async () => {
await loadVaults();
const channel = new BroadcastChannel('vault_updates');
channel.postMessage('refresh');
channel.close();
}, [loadVaults]);

return {
vaults,
refreshVaults,
isLoading,
errorOccurred,
};
}
