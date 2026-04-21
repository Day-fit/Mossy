import { createContext, type ReactNode, useContext, useEffect } from 'react';
import {
	useDeviceKeys,
	type UseDeviceKeysResult,
} from '../hooks/useDeviceKeys.ts';

const DeviceKeyContext = createContext<UseDeviceKeysResult | null>(null);

export function DeviceKeyProvider({ children }: { children: ReactNode }) {
	const deviceKeys = useDeviceKeys();

	useEffect(() => {

	}, []);

	return (
		<DeviceKeyContext.Provider value={deviceKeys}>
			{children}
		</DeviceKeyContext.Provider>
	);
}

export function useDeviceKey() {
	const ctx = useContext(DeviceKeyContext);
	if (!ctx) {
		throw new Error(
			'useDeviceKey must be used within a DeviceKeyProvider'
		);
	}
	return ctx;
}


