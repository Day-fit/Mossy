// useDeviceBootstrap.ts
import { executeRegisterDeviceRequest } from '../api/device.api.ts';
import { useDeviceKey } from '../context/DeviceKeyContext.tsx';
import { useDeviceStore } from '../store/deviceStore.ts';

export function useDeviceBootstrap() {
	const { deviceId, generateDeviceKeys, saveDeviceId } = useDeviceKey();
	const requiresSync = useDeviceStore((state) => state.requiresSync);
	const setRequiresSync = useDeviceStore((state) => state.setRequiresSync);

	const bootstrapDevice = async (): Promise<void> => {
		if (deviceId !== undefined) return;

		const keys = await generateDeviceKeys();
		const {
			deviceId: registeredDeviceId,
			requiresSync: deviceRequiresSync,
		} = await executeRegisterDeviceRequest(
			keys.Ed25519.public,
			keys.X25519.public
		);

		await saveDeviceId(registeredDeviceId);
		setRequiresSync(deviceRequiresSync);
	};

	return { bootstrapDevice, requiresSync };
}
