import { apiFetch } from "./client.ts";

export type UserVaultDto = {
    vaultId: string;
    vaultName: string;
    isOnline: boolean;
};

type RawUserVaultDto = {
    vaultId?: string;
    vaultName?: string;
    isOnline?: boolean;
    online?: boolean;
};

function normalizeVaultDto(rawVault: RawUserVaultDto): UserVaultDto {
    return {
        vaultId: rawVault.vaultId ?? "",
        vaultName: rawVault.vaultName ?? "",
        isOnline: rawVault.isOnline ?? rawVault.online ?? false,
    };
}

export async function executeUserVaultsRequest(): Promise<UserVaultDto[]> {
    const response = await apiFetch("/api/v1/passwords/vault/vaults", {
        method: "GET",
    });

    const rawResponse: unknown = await response.json();

    if (!Array.isArray(rawResponse)) {
        return [];
    }

    return rawResponse.map((vault) => normalizeVaultDto(vault as RawUserVaultDto));
}
