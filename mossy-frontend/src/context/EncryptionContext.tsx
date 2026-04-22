import { type ReactNode } from 'react';
import {
useEncryptionHook,
type UseEncryptionResult,
} from '../hooks/useEncryptionHook.ts';

export function EncryptionProvider({ children }: { children: ReactNode }) {
return children;
}

export function useEncryption(): UseEncryptionResult {
return useEncryptionHook();
}
