import { useCallback } from "react";

type UseEncryptionResult = {
    encrypt: (value: string) => string;
};

export function useEncryption(): UseEncryptionResult {
    const encrypt = useCallback((value: string) => {
        const bytes = new TextEncoder().encode(value);
        let binary = "";

        bytes.forEach((byte) => {
            binary += String.fromCharCode(byte);
        });

        return btoa(binary);
    }, []);

    return {
        encrypt,
    };
}
