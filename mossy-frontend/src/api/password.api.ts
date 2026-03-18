import { apiFetch } from "./client.ts";

export type SavePasswordRequestDto = {
    identifier: string;
    domain: string;
    cipherText: string;
    vaultId: string;
};

export type SavePasswordAcceptedResponseDto = {
    passwordId: string;
    message: string;
};

export async function executeSavePasswordRequest(
    payload: SavePasswordRequestDto
): Promise<SavePasswordAcceptedResponseDto> {
    const response = await apiFetch("/api/v1/password/save", {
        method: "POST",
        body: JSON.stringify(payload),
    });

    return response.json();
}
