import { apiFetch } from "./client.ts";

export type UserVaultDto = {
    vaultId: string;
    vaultName: string;
    isOnline: boolean;
};

export async function executeUserVaultsRequest(): Promise<UserVaultDto[]> {
    const response = await apiFetch("/api/v1/vault/vaults", {
        method: "GET",
    });

    return response.json();
}
