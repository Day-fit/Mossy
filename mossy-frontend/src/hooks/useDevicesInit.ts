import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore.ts';
import { useDeviceManagementStore } from '../store/deviceManagementStore.ts';
import { useDevices } from './useDevices.ts';

export function useDevicesInit() {
	const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
	const clear = useDeviceManagementStore((state) => state.clear);
	const { refreshDevices } = useDevices();

	useEffect(() => {
		if (!isAuthenticated) {
			clear();
			return;
		}

		void refreshDevices();
	}, [clear, isAuthenticated, refreshDevices]);
}
