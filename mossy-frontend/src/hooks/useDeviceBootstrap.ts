import { useDeviceKeys } from './useDeviceKeys.ts';
import { ensureDeviceRegistered } from '../api/service/device.service.ts';
import { useState } from 'react';

export function useDeviceBootstrap(userId: string | undefined) {
	const { deviceId, generateDeviceKeys, saveDeviceId } =
		useDeviceKeys(userId);

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
