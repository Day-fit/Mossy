import { useEffect } from 'react';
import {
    loadDeviceIdentity,
    loadStoredDeviceId,
} from '../auth/deviceIdentity.ts';
import { useDeviceStore } from '../store/deviceStore.ts';
import { useAuthStore } from '../store/authStore.ts';

export function useDeviceKeys(): void {
    const userId = useAuthStore((state) => state.userDetails?.userId);
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

    useEffect(() => {
        if (isAuthenticated !== true) {
            useDeviceStore.setState({ idKey: null, deviceId: null });
            return;
        }

        let disposed = false;

        void Promise.all([loadDeviceIdentity(), loadStoredDeviceId()]).then(
            ([identity, storedDeviceId]) => {
                if (!disposed) {
                    useDeviceStore.setState({
                        idKey: identity,
                        deviceId: storedDeviceId,
                    });
                }
            }
        );

        return () => {
            disposed = true;
        };
    }, [isAuthenticated, userId]);
}
