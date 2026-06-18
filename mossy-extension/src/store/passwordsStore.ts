import {
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { PasswordMetadataDto } from "../types";
import {
  initializePasswordMetadataCache,
  setCachedPasswords,
} from "../utils/passwordMetadataCache";

type PasswordsStoreState = {
  passwords: PasswordMetadataDto[];
  setPasswords: (value: PasswordMetadataDto[]) => void;
};

const PasswordsStoreContext = createContext<PasswordsStoreState | null>(null);

export function PasswordsStoreProvider({ children }: { children: ReactNode }) {
  const [passwords, setPasswordState] = useState<PasswordMetadataDto[]>([]);

  useEffect(() => {
    return initializePasswordMetadataCache(setPasswordState);
  }, []);

  const setPasswords = useCallback((value: PasswordMetadataDto[]) => {
    setPasswordState(value);
    setCachedPasswords(value);
  }, []);

  const value = useMemo<PasswordsStoreState>(
    () => ({ passwords, setPasswords }),
    [passwords, setPasswords],
  );

  return createElement(PasswordsStoreContext.Provider, { value }, children);
}

export function usePasswordsStore<T = PasswordsStoreState>(
  selector?: (state: PasswordsStoreState) => T,
): T {
  const state = useContext(PasswordsStoreContext);
  if (!state) {
    throw new Error("usePasswordsStore must be used within PasswordsStoreProvider");
  }
  return selector ? selector(state) : (state as T);
}
