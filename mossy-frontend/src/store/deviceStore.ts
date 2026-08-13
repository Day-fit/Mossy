import { create } from 'zustand';
import type { CryptoPair } from '../auth/deviceIdentity.ts';

type DeviceStoreState = {
	idKey: CryptoPair | null | undefined;
	deviceId: string | null | undefined;
	setIdKey: (value: CryptoPair | null | undefined) => void;
	setDeviceId: (value: string | null | undefined) => void;
};

export const useDeviceStore = create<DeviceStoreState>((set) => ({
	idKey: null,
	deviceId: null,
	setIdKey: (value) => set({ idKey: value }),
	setDeviceId: (value) => set({ deviceId: value }),
}));
