import { ensureDeviceRegistered } from '../api/service/device.service.ts';
import { useState } from 'react';
import { useDeviceKey } from '../context/DeviceKeyContext.tsx';

export function useDeviceBootstrap() {
	const { deviceId, generateDeviceKeys, saveDeviceId } = useDeviceKey();

	const [requiresSync, setRequiresSync] = useState(false);

	return {
		bootstrapDevice: () =>
			ensureDeviceRegistered({
				deviceId,
				generateDeviceKeys,
				saveDeviceId,
				setSyncRequired: setRequiresSync,
			}),
		requiresSync: requiresSync,
	};
}
