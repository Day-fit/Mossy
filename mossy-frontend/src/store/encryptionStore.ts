import { create } from 'zustand';
import { requireActiveUser } from '../auth/activeUser.ts';
import { vaultKeyId } from '../storage/keyIds.ts';
import { useAuthStore } from './authStore.ts';

type EncryptionStoreState = {
    passkeys: Record<string, Uint8Array | undefined>;
    getPasskey: (vaultId: string) => Uint8Array | undefined;
    setPasskey: (vaultId: string, passkey: Uint8Array, userId?: string) => void;
    clearPasskey: (vaultId: string, userId?: string) => void;
    clearPasskeys: () => void;
};

export const useEncryptionStore = create<EncryptionStoreState>((set, get) => ({
    passkeys: {},
    getPasskey: (vaultId) => {
        const userId = useAuthStore.getState().userDetails?.userId;
        return userId ? get().passkeys[vaultKeyId(userId, vaultId)] : undefined;
    },
    setPasskey: (
        vaultId,
        passkey,
        userId = useAuthStore.getState().userDetails?.userId
    ) => {
        const owner = requireActiveUser(userId);

        set((state) => ({
            passkeys: {
                ...state.passkeys,
                [vaultKeyId(owner, vaultId)]: passkey,
            },
        }));
    },
    clearPasskey: (
        vaultId,
        userId = useAuthStore.getState().userDetails?.userId
    ) => {
        if (!userId) return;

        set((state) => ({
            passkeys: {
                ...state.passkeys,
                [vaultKeyId(userId, vaultId)]: undefined,
            },
        }));
    },
    clearPasskeys: () => set({ passkeys: {} }),
}));

useAuthStore.subscribe((state, previous) => {
    if (
        state.userDetails?.userId !== previous.userDetails?.userId ||
        (state.isAuthenticated === false && previous.isAuthenticated !== false)
    ) {
        useEncryptionStore.getState().clearPasskeys();
    }
});
