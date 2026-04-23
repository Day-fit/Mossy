import { create } from 'zustand';
import type { CryptoPair } from '../hooks/useDeviceKeys.ts';

type DeviceStoreState = {
	idKey: CryptoPair | null | undefined;
	dhKey: CryptoPair | null;
	peerIdKey: CryptoPair | null;
	peerDhKey: CryptoPair | null;
	deviceId: string | null | undefined;
	requiresSync: boolean;
	setIdKey: (value: CryptoPair | null | undefined) => void;
	setDhKey: (value: CryptoPair | null) => void;
	setPeerIdKey: (value: CryptoPair | null | undefined) => void;
	setPeerDhKey: (value: CryptoPair | null) => void;
	setDeviceId: (value: string | null | undefined) => void;
	setRequiresSync: (value: boolean) => void;
};

export const useDeviceStore = create<DeviceStoreState>((set) => ({
	idKey: null,
	dhKey: null,
	peerIdKey: null,
	peerDhKey: null,
	deviceId: null,
	requiresSync: false,
	setIdKey: (value) => set({ idKey: value }),
	setDhKey: (value) => set({ dhKey: value }),
	setPeerIdKey: (value) => set({ peerIdKey: value }),
	setPeerDhKey: (value) => set({ peerDhKey: value }),
	setDeviceId: (value) => set({ deviceId: value }),
	setRequiresSync: (value) => set({ requiresSync: value }),
}));
