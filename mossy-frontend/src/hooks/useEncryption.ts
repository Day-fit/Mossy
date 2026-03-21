import {useCallback} from "react";

type UseEncryptionResult = {
    encrypt: (value: string) => string;
    decrypt: (value: string) => string;
};

export function useEncryption(): UseEncryptionResult {
    const encrypt = useCallback(
        (str: string) =>
            btoa(String.fromCharCode(...new TextEncoder().encode(str))),
        [],
    );
    const decrypt = useCallback(
        (str: string) =>
            new TextDecoder().decode(
                Uint8Array.from(atob(str), (c) => c.charCodeAt(0)),
            ),
        [],
    );

    return {
        encrypt,
        decrypt,
    };
}
