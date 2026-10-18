import { useEffect } from 'react';
import type { IDBPDatabase } from 'idb';
import {
    type CryptoPair,
    deviceDbRef,
    getDeviceDatabase,
    loadDeviceIdentity,
    loadStoredDeviceId,
} from '../auth/deviceIdentity.ts';
import { useDeviceStore } from '../store/deviceStore.ts';

type UseDeviceKeysResult = {
    idKey: CryptoPair | null | undefined;
    deviceId: string | null | undefined;
    dbRef: { current: IDBPDatabase | null };
};

export function useDeviceKeys(): UseDeviceKeysResult {
    const deviceKeys = useDeviceStore((state) => state.idKey);
    const deviceId = useDeviceStore((state) => state.deviceId);
    const setIdKey = useDeviceStore((state) => state.setIdKey);
    const setDeviceId = useDeviceStore((state) => state.setDeviceId);

    useEffect(() => {
        void Promise.all([loadDeviceIdentity(), loadStoredDeviceId()]).then(
            ([identity, storedDeviceId]) => {
                setIdKey(identity);
                setDeviceId(storedDeviceId);
            }
        );
    }, [setDeviceId, setIdKey]);

    return {
        idKey: deviceKeys,
        deviceId,
        dbRef: deviceDbRef,
    };
}

void getDeviceDatabase();
