import { create } from 'zustand';
import type {
	DeviceDetails,
	DeviceEnrollment,
} from '../api/deviceTrust.api.ts';

type DeviceManagementState = {
	devices: DeviceDetails[];
	enrollments: DeviceEnrollment[];
	isLoading: boolean;
	error: string | null;
	actionId: string | null;
	setDevices: (devices: DeviceDetails[]) => void;
	setEnrollments: (enrollments: DeviceEnrollment[]) => void;
	setIsLoading: (isLoading: boolean) => void;
	setError: (error: string | null) => void;
	setActionId: (actionId: string | null) => void;
	clear: () => void;
};

export const useDeviceManagementStore = create<DeviceManagementState>(
	(set) => ({
		devices: [],
		enrollments: [],
		isLoading: false,
		error: null,
		actionId: null,
		setDevices: (devices) => set({ devices }),
		setEnrollments: (enrollments) => set({ enrollments }),
		setIsLoading: (isLoading) => set({ isLoading }),
		setError: (error) => set({ error }),
		setActionId: (actionId) => set({ actionId }),
		clear: () =>
			set({
				devices: [],
				enrollments: [],
				isLoading: false,
				error: null,
				actionId: null,
			}),
	})
);
