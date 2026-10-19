import { create } from 'zustand';
import { useAuthStore } from './authStore.ts';

type EncryptionStoreState = {
    keys: Record<string, CryptoKey>;
    getKey: (vaultId: string) => CryptoKey | undefined;
    setKey: (vaultId: string, userId: string, key: CryptoKey) => void;
    clearKeys: () => void;
};

const keyId = (userId: string, vaultId: string) => userId + ':' + vaultId;

export const useEncryptionStore = create<EncryptionStoreState>((set, get) => ({
    keys: {},
    getKey: (vaultId) => {
        const userId = useAuthStore.getState().userDetails?.userId;
        return userId ? get().keys[keyId(userId, vaultId)] : undefined;
    },
    setKey: (vaultId, userId, key) => {
        if (useAuthStore.getState().userDetails?.userId !== userId)
            throw new Error('Account changed. Please try again.');
        set((state) => ({ keys: { ...state.keys, [keyId(userId, vaultId)]: key } }));
    },
    clearKeys: () => set({ keys: {} }),
}));

useAuthStore.subscribe((state, previous) => {
    if (
        state.userDetails?.userId !== previous.userDetails?.userId ||
        state.isAuthenticated === false
    )
        useEncryptionStore.getState().clearKeys();
});
