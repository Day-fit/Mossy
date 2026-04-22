import { type ReactNode, useEffect } from 'react';
import { useDeviceBootstrap } from '../hooks/useDeviceBootstrap.ts';
import { useAuth } from './AuthContext.tsx';

type DeviceBootstrapState = {
bootstrapDevice: () => Promise<void>;
requiresSync: boolean;
};

export const DeviceBootstrapProvider = ({
children,
}: {
children: ReactNode;
}) => {
const { isAuthenticated, userDetails } = useAuth();
const { bootstrapDevice } = useDeviceBootstrap();

useEffect(() => {
if (!isAuthenticated || !userDetails?.userId) return;

void bootstrapDevice();
}, [bootstrapDevice, isAuthenticated, userDetails?.userId]);

return children;
};

export const useDeviceBootstrapContext = (): DeviceBootstrapState => {
return useDeviceBootstrap();
};
