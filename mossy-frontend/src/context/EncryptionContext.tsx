import { type ReactNode } from 'react';
import {
useEncryptionHook,
type UseEncryptionResult,
} from '../hooks/useEncryptionHook.ts';

export function EncryptionProvider({ children }: { children: ReactNode }) {
	// Compatibility wrapper for existing app wiring; encryption state is stored in Zustand.
	return children;
}

export function useEncryption(): UseEncryptionResult {
return useEncryptionHook();
}
