import { apiFetch } from './client.ts';

export type UserVaultDto = {
	vaultId: string;
	vaultName: string;
	isOnline: boolean;
	lastSeenAt: string | null;
};

type RawUserVaultDto = {
	vaultId?: string;
	vaultName?: string;
	isOnline?: boolean;
	online?: boolean;
	lastSeenAt?: string | null;
};

export type VaultRegistrationDto = {
	vaultId: string;
	apiKey: string;
};

export type ServerResponseDto = {
	message: string;
};

function normalizeVaultDto(rawVault: RawUserVaultDto): UserVaultDto {
	return {
		vaultId: rawVault.vaultId ?? '',
		vaultName: rawVault.vaultName ?? '',
		isOnline: rawVault.isOnline ?? rawVault.online ?? false,
		lastSeenAt: rawVault.lastSeenAt ?? null,
	};
}

export async function executeUserVaultsRequest(): Promise<UserVaultDto[]> {
	const response = await apiFetch('/api/v1/passwords/vault/vaults', {
		method: 'GET',
	});

	const rawResponse: unknown = await response.json();

	if (!Array.isArray(rawResponse)) {
		return [];
	}

	return rawResponse.map((vault) =>
		normalizeVaultDto(vault as RawUserVaultDto)
	);
}

export async function executeCreateVaultRequest(
	vaultName: string
): Promise<VaultRegistrationDto> {
	const response = await apiFetch('/api/v1/passwords/vault/register', {
		method: 'POST',
		body: JSON.stringify({ vaultName }),
	});

	return response.json();
}

export async function executeDeleteVaultRequest(
	vaultId: string
): Promise<ServerResponseDto> {
	const response = await apiFetch(`/api/v1/passwords/vault/${vaultId}`, {
		method: 'DELETE',
	});

	return response.json();
}

export async function executeUpdateVaultRequest(
	vaultId: string,
	vaultName: string
): Promise<ServerResponseDto> {
	const response = await apiFetch(`/api/v1/passwords/vault/${vaultId}`, {
		method: 'PUT',
		body: JSON.stringify({ vaultName }),
	});

	return response.json();
}
