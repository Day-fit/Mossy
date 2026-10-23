import { useEffect } from 'react';
import { receiveEnrollmentEvents } from 'mossy-api-client/deviceTrust.api';
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

        const controller = new AbortController();
        let retryTimer: ReturnType<typeof setTimeout> | undefined;
        const refresh = () => void refreshDevices(controller.signal);
        const connect = async () => {
            try {
                await receiveEnrollmentEvents(
                    controller.signal,
                    (enrollment) => {
                        if (!controller.signal.aborted) {
                            useDeviceManagementStore
                                .getState()
                                .upsertEnrollment(enrollment);
                        }
                    },
                    refresh
                );
            } catch {
                // Keep the snapshot usable during transient stream failures.
            } finally {
                if (!controller.signal.aborted) {
                    retryTimer = setTimeout(() => void connect(), 1_000);
                }
            }
        };

        void refreshDevices(controller.signal).then(() => {
            if (!controller.signal.aborted) void connect();
        });
        return () => {
            controller.abort();
            clearTimeout(retryTimer);
        };
    }, [clear, isAuthenticated, refreshDevices]);
}
