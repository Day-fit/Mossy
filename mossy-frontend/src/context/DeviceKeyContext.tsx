import { type ReactNode } from 'react';
import {
useDeviceKeys,
type UseDeviceKeysResult,
} from '../hooks/useDeviceKeys.ts';
import { useAuth } from './AuthContext.tsx';

export function DeviceKeyProvider({ children }: { children: ReactNode }) {
	const { userDetails } = useAuth();
	// Compatibility wrapper for existing app wiring; initializes device key state in Zustand.
	useDeviceKeys(userDetails?.userId);
	return children;
}

export function useDeviceKey(): UseDeviceKeysResult {
const { userDetails } = useAuth();
return useDeviceKeys(userDetails?.userId);
}
