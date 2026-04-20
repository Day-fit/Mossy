import { createContext, type ReactNode, useContext } from 'react';
import {
	useEncryptionHook,
	type UseEncryptionResult,
} from '../hooks/useEncryptionHook.ts';

const EncryptionContext = createContext<UseEncryptionResult | null>(null);

export function EncryptionProvider({ children }: { children: ReactNode }) {
	const encryption = useEncryptionHook();
	return (
		<EncryptionContext.Provider value={encryption}>
			{children}
		</EncryptionContext.Provider>
	);
}

export function useEncryption() {
	const ctx = useContext(EncryptionContext);
	if (!ctx) {
		throw new Error(
			'useEncryptionContext must be used within an EncryptionProvider'
		);
	}
	return ctx;
}
