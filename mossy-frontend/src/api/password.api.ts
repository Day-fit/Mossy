import { apiFetch } from "./client.ts";

export type SavePasswordRequestDto = {
    identifier: string;
    domain: string;
    cipherText: string;
    vaultId: string;
};

export type UpdatePasswordRequestDto = SavePasswordRequestDto & {
    passwordId: string;
};

export type DeletePasswordRequestDto = {
    passwordId: string;
    vaultId: string;
};

export type PasswordMetadataDto = {
    passwordId: string;
    identifier: string;
    domain: string;
    lastModified: string;
};

export type CiphertextResponseDto = {
    ciphertext: string;
};

export type ServerResponseDto = {
    message: string;
};

export async function executeSavePasswordRequest(
    payload: SavePasswordRequestDto
): Promise<ServerResponseDto> {
    const response = await apiFetch("/api/v1/password/save", {
        method: "POST",
        body: JSON.stringify(payload),
    });

    return response.json();
}

export async function executeUpdatePasswordRequest(
    payload: UpdatePasswordRequestDto
): Promise<ServerResponseDto> {
    const response = await apiFetch("/api/v1/password/update", {
        method: "PATCH",
        body: JSON.stringify(payload),
    });

    return response.json();
}

export async function executeDeletePasswordRequest(
    payload: DeletePasswordRequestDto
): Promise<ServerResponseDto> {
    const response = await apiFetch("/api/v1/password/delete", {
        method: "DELETE",
        body: JSON.stringify(payload),
    });

    return response.json();
}

export async function executePasswordMetadataRequest(vaultId: string): Promise<PasswordMetadataDto[]> {
    const response = await apiFetch(`/api/v1/password/metadata?vaultId=${encodeURIComponent(vaultId)}`, {
        method: "GET",
    });

    return response.json();
}

export async function executePasswordCiphertextRequest(
    passwordId: string,
    vaultId: string
): Promise<CiphertextResponseDto> {
    const response = await apiFetch(
        `/api/v1/password/ciphertext/${encodeURIComponent(passwordId)}?vaultId=${encodeURIComponent(vaultId)}`,
        {
            method: "GET",
        }
    );

    return response.json();
}
