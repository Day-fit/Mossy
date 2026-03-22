import {type Dispatch, type SetStateAction, useCallback, useState} from "react";

type UseEncryptionResult = {
    encrypt: (value: string) => string;
    decrypt: (value: string) => string;
    isPinPresent: boolean;
    setEncryptionPin: Dispatch<SetStateAction<string | undefined>>;
};

export function useEncryption(): UseEncryptionResult {
    const [encryptionPin, setEncryptionPin] = useState<string | undefined>(undefined)

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
        isPinPresent: !!encryptionPin,
        setEncryptionPin,
    };
}
