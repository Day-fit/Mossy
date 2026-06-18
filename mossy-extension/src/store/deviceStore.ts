import {
  createContext,
  createElement,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import type { CryptoPair } from "../types";

type DeviceStoreState = {
  idKey: CryptoPair | null | undefined;
  dhKey: CryptoPair | null;
  deviceId: string | null | undefined;
  requiresSync: boolean;
  setIdKey: (value: CryptoPair | null | undefined) => void;
  setDhKey: (value: CryptoPair | null) => void;
  setDeviceId: (value: string | null | undefined) => void;
  setRequiresSync: (value: boolean) => void;
};

const DeviceStoreContext = createContext<DeviceStoreState | null>(null);

export function DeviceStoreProvider({ children }: { children: ReactNode }) {
  const [idKey, setIdKey] = useState<CryptoPair | null | undefined>(null);
  const [dhKey, setDhKey] = useState<CryptoPair | null>(null);
  const [deviceId, setDeviceId] = useState<string | null | undefined>(null);
  const [requiresSync, setRequiresSync] = useState(false);

  const value = useMemo<DeviceStoreState>(
    () => ({
      idKey,
      dhKey,
      deviceId,
      requiresSync,
      setIdKey,
      setDhKey,
      setDeviceId,
      setRequiresSync,
    }),
    [deviceId, dhKey, idKey, requiresSync],
  );

  return createElement(DeviceStoreContext.Provider, { value }, children);
}

export function useDeviceStore<T = DeviceStoreState>(
  selector?: (state: DeviceStoreState) => T,
): T {
  const state = useContext(DeviceStoreContext);
  if (!state) throw new Error("useDeviceStore must be used within DeviceStoreProvider");
  return selector ? selector(state) : (state as T);
}
