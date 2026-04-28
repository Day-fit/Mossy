import { create } from "zustand";

type RevealedStoreState = {
  revealed: Record<string, string>;
  setRevealedPassword: (passwordId: string, value: string) => void;
  hidePassword: (passwordId: string) => void;
};

export const useRevealedStore = create<RevealedStoreState>((set) => ({
  revealed: {},
  setRevealedPassword: (passwordId, value) =>
    set((state) => ({ revealed: { ...state.revealed, [passwordId]: value } })),
  hidePassword: (passwordId) =>
    set((state) => {
      const next = { ...state.revealed };
      delete next[passwordId];
      return { revealed: next };
    }),
}));
