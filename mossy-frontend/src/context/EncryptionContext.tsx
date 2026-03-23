import { createContext, type ReactNode, useContext } from 'react';
import {
	useEncryption,
	type UseEncryptionResult,
} from '../hooks/useEncryption.ts';

const EncryptionContext = createContext<UseEncryptionResult | null>(null);

export function EncryptionProvider({ children }: { children: ReactNode }) {
	const encryption = useEncryption();
	return (
		<EncryptionContext.Provider value={encryption}>
			{children}
		</EncryptionContext.Provider>
	);
}

export function useEncryptionContext() {
	const ctx = useContext(EncryptionContext);
	if (!ctx) {
		throw new Error(
			'useEncryptionContext must be used within an EncryptionProvider'
		);
	}
	return ctx;
}
