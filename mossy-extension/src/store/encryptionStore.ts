import {
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type EncryptionStoreState = {
  pins: Record<string, string | undefined>;
  setPin: (vaultId: string, pin: string) => void;
  clearPin: (vaultId: string) => void;
};

const EncryptionStoreContext = createContext<EncryptionStoreState | null>(null);

export function EncryptionStoreProvider({ children }: { children: ReactNode }) {
  const [pins, setPins] = useState<Record<string, string | undefined>>({});

  const setPin = useCallback((vaultId: string, pin: string) => {
    setPins((current) => ({ ...current, [vaultId]: pin }));
    if (typeof chrome !== "undefined" && chrome.storage?.session) {
      void chrome.storage.session.set({ [`pin:${vaultId}`]: pin });
    }
  }, []);

  const clearPin = useCallback((vaultId: string) => {
    setPins((current) => ({ ...current, [vaultId]: undefined }));
    if (typeof chrome !== "undefined" && chrome.storage?.session) {
      void chrome.storage.session.remove(`pin:${vaultId}`);
    }
  }, []);

  const value = useMemo<EncryptionStoreState>(
    () => ({ pins, setPin, clearPin }),
    [clearPin, pins, setPin],
  );

  return createElement(EncryptionStoreContext.Provider, { value }, children);
}

export function useEncryptionStore<T = EncryptionStoreState>(
  selector?: (state: EncryptionStoreState) => T,
): T {
  const state = useContext(EncryptionStoreContext);
  if (!state) {
    throw new Error(
      "useEncryptionStore must be used within EncryptionStoreProvider",
    );
  }
  return selector ? selector(state) : (state as T);
}
