import {
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type RevealedStoreState = {
  revealed: Record<string, string>;
  setRevealedPassword: (passwordId: string, value: string) => void;
  hidePassword: (passwordId: string) => void;
};

const RevealedStoreContext = createContext<RevealedStoreState | null>(null);

export function RevealedStoreProvider({ children }: { children: ReactNode }) {
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  const setRevealedPassword = useCallback(
    (passwordId: string, value: string) => {
      setRevealed((current) => ({ ...current, [passwordId]: value }));
    },
    [],
  );

  const hidePassword = useCallback((passwordId: string) => {
    setRevealed((current) => {
      const next = { ...current };
      delete next[passwordId];
      return next;
    });
  }, []);

  const value = useMemo<RevealedStoreState>(
    () => ({ revealed, setRevealedPassword, hidePassword }),
    [hidePassword, revealed, setRevealedPassword],
  );

  return createElement(RevealedStoreContext.Provider, { value }, children);
}

export function useRevealedStore<T = RevealedStoreState>(
  selector?: (state: RevealedStoreState) => T,
): T {
  const state = useContext(RevealedStoreContext);
  if (!state) {
    throw new Error("useRevealedStore must be used within RevealedStoreProvider");
  }
  return selector ? selector(state) : (state as T);
}
