import { apiFetch } from './client';
import { API_BASE } from '../utils/constants';
import type { UserVaultDto } from '../types';

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
    vaultId: rawVault.vaultId ?? '',
    vaultName: rawVault.vaultName ?? '',
    isOnline: rawVault.isOnline ?? rawVault.online ?? false,
    passwordCount: rawVault.passwordCount ?? 0,
    lastSeenAt: rawVault.lastSeenAt ?? null,
  };
}

export async function executeUserVaultsRequest(): Promise<UserVaultDto[]> {
  const response = await apiFetch(`${API_BASE.password}/api/v1/passwords/vault/vaults`, {
    method: 'GET',
  });

  const rawResponse: unknown = await response.json();

  if (!Array.isArray(rawResponse)) {
    return [];
  }

  return rawResponse.map((vault) => normalizeVaultDto(vault as RawUserVaultDto));
}
