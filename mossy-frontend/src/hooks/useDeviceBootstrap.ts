import { ensureDeviceRegistered } from '../api/service/device.service.ts';
import { useDeviceKey } from '../context/DeviceKeyContext.tsx';
import { useDeviceStore } from '../store/deviceStore.ts';

export function useDeviceBootstrap() {
const { deviceId, generateDeviceKeys, saveDeviceId } = useDeviceKey();
const requiresSync = useDeviceStore((state) => state.requiresSync);
const setRequiresSync = useDeviceStore((state) => state.setRequiresSync);

return {
bootstrapDevice: () =>
ensureDeviceRegistered({
deviceId,
generateDeviceKeys,
saveDeviceId,
setSyncRequired: setRequiresSync,
}),
requiresSync,
};
}
