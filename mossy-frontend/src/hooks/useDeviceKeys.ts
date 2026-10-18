import { useEffect } from 'react';
import type { IDBPDatabase } from 'idb';
import {
    type CryptoPair,
    type DeviceDatabase,
    deviceDbRef,
    loadDeviceIdentity,
    loadStoredDeviceId,
} from '../auth/deviceIdentity.ts';
import { useDeviceStore } from '../store/deviceStore.ts';
import { useAuthStore } from '../store/authStore.ts';

type UseDeviceKeysResult = {
    idKey: CryptoPair | null | undefined;
    deviceId: string | null | undefined;
    dbRef: { current: IDBPDatabase<DeviceDatabase> | null };
};

export function useDeviceKeys(): UseDeviceKeysResult {
    const deviceKeys = useDeviceStore((state) => state.idKey);
    const deviceId = useDeviceStore((state) => state.deviceId);
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

    return {
        idKey: deviceKeys,
        deviceId,
        dbRef: deviceDbRef,
    };
}
