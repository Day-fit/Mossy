import { useEffect } from 'react';
import {
	executeGenerateNonceRequest,
	executeRegisterDeviceRequest,
} from '../api/device.api.ts';
import { useDeviceKey } from '../context/DeviceKeyContext.tsx';
import type { KeyRecord } from './useDeviceKeys.ts';

export type UseDeviceSyncResult = {
	isInitialized: boolean;
	nonce: string | null;
	syncCode: string | null;
};

export function useDeviceSync(): UseDeviceSyncResult {
	const { generateDeviceKeys, deviceKeys } = useDeviceKey();

	useEffect(() => {
		if (!deviceKeys) {
			generateDeviceKeys().then((res: KeyRecord) => {
				executeRegisterDeviceRequest(
					res.X25519.public,
					res.Ed25519.public
				).then(() => performDeviceSync());
			});
			return;
		}

		performDeviceSync();
	}, [deviceKeys, generateDeviceKeys]);

	const performDeviceSync = async () => {
		try {
			await executeGenerateNonceRequest();
			// TODO: Handle nonce response and update state with nonce/syncCode
		} catch (error) {
			console.error('Device synchronization failed:', error);
		}
	};

	return {
		isInitialized: !!deviceKeys,
		nonce: null,
		syncCode: null,
	};
}



