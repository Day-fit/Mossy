import { create } from 'zustand';
import type { KeyRecord } from '../hooks/useDeviceKeys.ts';

type DeviceStoreState = {
deviceKeys: KeyRecord | null | undefined;
deviceId: string | null | undefined;
requiresSync: boolean;
setDeviceKeys: (value: KeyRecord | null | undefined) => void;
setDeviceId: (value: string | null | undefined) => void;
setRequiresSync: (value: boolean) => void;
};

export const useDeviceStore = create<DeviceStoreState>((set) => ({
deviceKeys: null,
deviceId: null,
requiresSync: false,
setDeviceKeys: (value) => set({ deviceKeys: value }),
setDeviceId: (value) => set({ deviceId: value }),
setRequiresSync: (value) => set({ requiresSync: value }),
}));
