import { apiFetch } from "./client.ts";

export type UserVaultDto = {
    vaultId: string;
    vaultName: string;
    isOnline: boolean;
    passwordCount: number;
    lastSeenAt: string | null;
};

type RawUserVaultDto = {
    vaultId?: string;
    vaultName?: string;
    isOnline?: boolean;
    online?: boolean;
    passwordCount?: number;
    lastSeenAt?: string;
};

function normalizeVaultDto(rawVault: RawUserVaultDto): UserVaultDto {
    return {
        vaultId: rawVault.vaultId ?? "",
        vaultName: rawVault.vaultName ?? "",
        isOnline: rawVault.isOnline ?? rawVault.online ?? false,
        passwordCount: rawVault.passwordCount ?? 0,
        lastSeenAt: rawVault.lastSeenAt ?? null,
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

export type CreateVaultResponseDto = {
    vaultId: string;
    apiKey: string;
    message: string;
};

export async function executeCreateVaultRequest(vaultName: string): Promise<CreateVaultResponseDto> {
    const response = await apiFetch("/api/v1/passwords/vault", {
        method: "POST",
        body: JSON.stringify({ vaultName }),
    });

    return await response.json() as CreateVaultResponseDto;
}

export type VaultActionResponseDto = {
    message: string;
};

export async function executeUpdateVaultRequest(vaultId: string, vaultName: string): Promise<VaultActionResponseDto> {
    const response = await apiFetch(`/api/v1/passwords/vault/${vaultId}`, {
        method: "PUT",
        body: JSON.stringify({ vaultName }),
    });

    return await response.json() as VaultActionResponseDto;
}

export async function executeDeleteVaultRequest(vaultId: string): Promise<VaultActionResponseDto> {
    const response = await apiFetch(`/api/v1/passwords/vault/${vaultId}`, {
        method: "DELETE",
    });

    return await response.json() as VaultActionResponseDto;
}
