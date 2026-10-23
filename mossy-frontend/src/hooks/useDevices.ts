import { useCallback } from 'react';
import {
    executeApproveEnrollmentRequest,
    executeBlockDeviceRequest,
    executeGetDevicesRequest,
    executeGetEnrollmentsRequest,
    executeUnblockDeviceRequest,
} from 'mossy-api-client/deviceTrust.api';
import { useDeviceManagementStore } from '../store/deviceManagementStore.ts';

function errorMessage(error: unknown): string {
    return error instanceof Error
        ? error.message
        : 'Device information could not be updated.';
}

export function useDevices() {
    const state = useDeviceManagementStore();

    const refreshDevices = useCallback(async (signal?: AbortSignal) => {
        const store = useDeviceManagementStore.getState();
        const initialEnrollmentIds = new Set(
            store.enrollments.map((item) => item.id)
        );
        store.setIsLoading(true);
        store.setError(null);
        try {
            const [devices, enrollments] = await Promise.all([
                executeGetDevicesRequest(),
                executeGetEnrollmentsRequest(),
            ]);
            if (signal?.aborted) return;
            store.setDevices(devices);
            // Preserve events received while the snapshot request was in flight.
            const newEnrollments = useDeviceManagementStore
                .getState()
                .enrollments.filter(
                    (item) =>
                        !initialEnrollmentIds.has(item.id) &&
                        !enrollments.some(
                            (enrollment) => enrollment.id === item.id
                        )
                );
            store.setEnrollments([...enrollments, ...newEnrollments]);
        } catch (error) {
            if (!signal?.aborted) store.setError(errorMessage(error));
        } finally {
            if (!signal?.aborted) store.setIsLoading(false);
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
