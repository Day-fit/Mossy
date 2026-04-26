import { useCallback } from 'react';
import { executeRegisterDeviceRequest } from '../api/device.api';
import { useAuthStore } from '../store/authStore';
import { useDeviceStore } from '../store/deviceStore';
import { useDeviceKeys } from './useDeviceKeys';

export function useDeviceBootstrap() {
  const userId = useAuthStore((state) => state.userDetails?.userId);
  const { deviceId, idKey, generateIdKey, saveDeviceId } = useDeviceKeys(userId);
  const setRequiresSync = useDeviceStore((state) => state.setRequiresSync);

  const bootstrapDevice = useCallback(async (): Promise<void> => {
    if (!userId) return;
    if (deviceId) return;

    const resolvedIdKey = idKey ?? (await generateIdKey());
    const { deviceId: registeredDeviceId, requiresSync } = await executeRegisterDeviceRequest(resolvedIdKey.public);

    await saveDeviceId(registeredDeviceId);
    setRequiresSync(requiresSync);
  }, [deviceId, generateIdKey, idKey, saveDeviceId, setRequiresSync, userId]);

  return { bootstrapDevice };
}
