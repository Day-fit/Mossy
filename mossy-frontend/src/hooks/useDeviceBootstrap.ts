import { executeRegisterDeviceRequest } from '../api/device.api.ts';
import { useAuthStore } from '../store/authStore.ts';
import { useDeviceStore } from '../store/deviceStore.ts';
import { useDeviceKeys } from './useDeviceKeys.ts';

export function useDeviceBootstrap() {
	const userId = useAuthStore((state) => state.userDetails?.userId);
	const { deviceId, generateIdKey, saveDeviceId } = useDeviceKeys(userId);
	const requiresSync = useDeviceStore((state) => state.requiresSync);
	const setRequiresSync = useDeviceStore((state) => state.setRequiresSync);

	const bootstrapDevice = async (): Promise<void> => {
		if (deviceId !== undefined) return;

		const idKey = await generateIdKey();
		const {
			deviceId: registeredDeviceId,
			requiresSync: deviceRequiresSync,
		} = await executeRegisterDeviceRequest(idKey.public);

		await saveDeviceId(registeredDeviceId);
		setRequiresSync(deviceRequiresSync);
	};

	return { bootstrapDevice, requiresSync };
}
