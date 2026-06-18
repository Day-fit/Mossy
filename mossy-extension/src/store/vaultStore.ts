import {
  createContext,
  createElement,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import type { UserVaultDto } from "../types";

type VaultStoreState = {
  vaults: UserVaultDto[];
  selectedVaultId: string;
  setVaults: (value: UserVaultDto[]) => void;
  setSelectedVaultId: (value: string) => void;
};

const VaultStoreContext = createContext<VaultStoreState | null>(null);

export function VaultStoreProvider({ children }: { children: ReactNode }) {
  const [vaults, setVaults] = useState<UserVaultDto[]>([]);
  const [selectedVaultId, setSelectedVaultId] = useState("");

  const value = useMemo<VaultStoreState>(
    () => ({
      vaults,
      selectedVaultId,
      setVaults,
      setSelectedVaultId,
    }),
    [selectedVaultId, vaults],
  );

  return createElement(VaultStoreContext.Provider, { value }, children);
}

export function useVaultStore<T = VaultStoreState>(
  selector?: (state: VaultStoreState) => T,
): T {
  const state = useContext(VaultStoreContext);
  if (!state) throw new Error("useVaultStore must be used within VaultStoreProvider");
  return selector ? selector(state) : (state as T);
}
