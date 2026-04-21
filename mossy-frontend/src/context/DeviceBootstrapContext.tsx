import { createContext, type ReactNode, useContext, useEffect } from 'react';
import { useDeviceBootstrap } from '../hooks/useDeviceBootstrap.ts';
import { useAuth } from './AuthContext.tsx';

type DeviceBootstrapState = {
	bootstrapDevice: () => Promise<void>;
	requiresSync: boolean;
};

const DeviceBootstrapContext = createContext<DeviceBootstrapState | null>(null);

export const DeviceBootstrapProvider = ({
	children,
}: {
	children: ReactNode;
}) => {
	const { isAuthenticated, userDetails } = useAuth();
	const { bootstrapDevice, requiresSync } = useDeviceBootstrap(
		userDetails?.userId
	);

	useEffect(() => {
		if (!isAuthenticated || !userDetails?.userId) return;

		void bootstrapDevice();
	}, [bootstrapDevice, isAuthenticated, userDetails?.userId]);

	return (
		<DeviceBootstrapContext.Provider
			value={{ bootstrapDevice, requiresSync }}
		>
			{children}
		</DeviceBootstrapContext.Provider>
	);
};

export const useDeviceBootstrapContext = () => {
	const context = useContext(DeviceBootstrapContext);
	if (!context) {
		throw new Error(
			'useDeviceBootstrap must be used within a DeviceBootstrapProvider'
		);
	}
	return context;
};
