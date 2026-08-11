import { useCallback } from 'react';
import {
	executeApproveEnrollmentRequest,
	executeBlockDeviceRequest,
	executeGetDevicesRequest,
	executeGetEnrollmentsRequest,
	executeUnblockDeviceRequest,
} from '../api/deviceTrust.api.ts';
import { useDeviceManagementStore } from '../store/deviceManagementStore.ts';

function errorMessage(error: unknown): string {
	return error instanceof Error
		? error.message
		: 'Device information could not be updated.';
}

export function useDevices() {
	const state = useDeviceManagementStore();

	const refreshDevices = useCallback(async () => {
		const store = useDeviceManagementStore.getState();
		store.setIsLoading(true);
		store.setError(null);
		try {
			const [devices, enrollments] = await Promise.all([
				executeGetDevicesRequest(),
				executeGetEnrollmentsRequest(),
			]);
			store.setDevices(devices);
			store.setEnrollments(enrollments);
		} catch (error) {
			store.setError(errorMessage(error));
		} finally {
			store.setIsLoading(false);
		}
	}, []);

	const runAction = useCallback(
		async (id: string, action: () => Promise<void>) => {
			const store = useDeviceManagementStore.getState();
			store.setActionId(id);
			store.setError(null);
			try {
				await action();
				await refreshDevices();
				return true;
			} catch (error) {
				store.setError(errorMessage(error));
				return false;
			} finally {
				store.setActionId(null);
			}
		},
		[refreshDevices]
	);

	return {
		...state,
		refreshDevices,
		approveEnrollment: (id: string) =>
			runAction(id, () => executeApproveEnrollmentRequest(id)),
		blockDevice: (id: string) =>
			runAction(id, () => executeBlockDeviceRequest(id)),
		unblockDevice: (id: string) =>
			runAction(id, () => executeUnblockDeviceRequest(id)),
	};
}
