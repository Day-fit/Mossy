import { create } from 'zustand';

type EncryptionStoreState = {
  pins: Record<string, string | undefined>;
  setPin: (vaultId: string, pin: string) => void;
  clearPin: (vaultId: string) => void;
};

export const useEncryptionStore = create<EncryptionStoreState>((set) => ({
  pins: {},
  setPin: (vaultId, pin) => {
    set((state) => ({
      pins: {
        ...state.pins,
        [vaultId]: pin,
      },
    }));
    if (typeof chrome !== 'undefined' && chrome.storage?.session) {
      void chrome.storage.session.set({ [`pin:${vaultId}`]: pin });
    }
  },
  clearPin: (vaultId) => {
    set((state) => ({
      pins: {
        ...state.pins,
        [vaultId]: undefined,
      },
    }));
    if (typeof chrome !== 'undefined' && chrome.storage?.session) {
      void chrome.storage.session.remove(`pin:${vaultId}`);
    }
  },
}));
