import { create } from 'zustand';
import { requireActiveUser } from '../auth/activeUser.ts';
import { vaultKeyId } from '../storage/keyIds.ts';
import { useAuthStore } from './authStore.ts';

type EncryptionStoreState = {
    keys: Record<string, CryptoKey | undefined>;
    getKey: (vaultId: string) => CryptoKey | undefined;
    setUnlocked: (
        vaultId: string,
        passkey: Uint8Array,
        key: CryptoKey,
        userId: string
    ) => void;
    passkeys: Record<string, Uint8Array | undefined>;
    getPasskey: (vaultId: string) => Uint8Array | undefined;
    setPasskey: (vaultId: string, passkey: Uint8Array, userId?: string) => void;
    clearPasskey: (vaultId: string, userId?: string) => void;
    clearPasskeys: () => void;
};

export const useEncryptionStore = create<EncryptionStoreState>((set, get) => ({
    keys: {},
    getKey: (vaultId) => {
        const owner = useAuthStore.getState().userDetails?.userId;
        return owner ? get().keys[vaultKeyId(owner, vaultId)] : undefined;
    },
    setUnlocked: (vaultId, passkey, key, owner) => {
        requireActiveUser(owner);
        set((state) => ({
            passkeys: {
                ...state.passkeys,
                [vaultKeyId(owner, vaultId)]: passkey,
            },
            keys: { ...state.keys, [vaultKeyId(owner, vaultId)]: key },
        }));
    },
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
            keys: { ...state.keys, [vaultKeyId(owner, vaultId)]: undefined },
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
            keys: { ...state.keys, [vaultKeyId(userId, vaultId)]: undefined },
            passkeys: {
                ...state.passkeys,
                [vaultKeyId(userId, vaultId)]: undefined,
            },
        }));
    },
    clearPasskeys: () => set({ passkeys: {}, keys: {} }),
}));

useAuthStore.subscribe((state, previous) => {
    if (
        state.userDetails?.userId !== previous.userDetails?.userId ||
        (state.isAuthenticated === false && previous.isAuthenticated !== false)
    ) {
        useEncryptionStore.getState().clearPasskeys();
    }
});
