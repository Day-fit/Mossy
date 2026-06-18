import {
  createContext,
  createElement,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import type { CapturedCredential } from "../types";

type CapturedStoreState = {
  captured: CapturedCredential[];
  setCaptured: (value: CapturedCredential[]) => void;
};

const CapturedStoreContext = createContext<CapturedStoreState | null>(null);

export function CapturedStoreProvider({ children }: { children: ReactNode }) {
  const [captured, setCaptured] = useState<CapturedCredential[]>([]);

  const value = useMemo<CapturedStoreState>(
    () => ({ captured, setCaptured }),
    [captured],
  );

  return createElement(CapturedStoreContext.Provider, { value }, children);
}

export function useCapturedStore<T = CapturedStoreState>(
  selector?: (state: CapturedStoreState) => T,
): T {
  const state = useContext(CapturedStoreContext);
  if (!state) {
    throw new Error("useCapturedStore must be used within CapturedStoreProvider");
  }
  return selector ? selector(state) : (state as T);
}
