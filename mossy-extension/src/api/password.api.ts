import { apiFetch } from './client';
import { API_BASE } from '../utils/constants';
import type { PasswordMetadataDto } from '../types';

export type SavePasswordRequestDto = {
  identifier: string;
  domain: string;
  cipherText: string;
  vaultId: string;
};

export type CiphertextResponseDto = {
  ciphertext: string;
};

export async function executeSavePasswordRequest(payload: SavePasswordRequestDto): Promise<{ message: string }> {
  const response = await apiFetch(`${API_BASE.password}/api/v1/passwords/save`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return response.json();
}

export async function executePasswordMetadataRequest(vaultId: string): Promise<PasswordMetadataDto[]> {
  const response = await apiFetch(
    `${API_BASE.password}/api/v1/passwords/metadata?vaultId=${encodeURIComponent(vaultId)}`,
    { method: 'GET' }
  );

  return response.json();
}

export async function executePasswordCiphertextRequest(passwordId: string, vaultId: string): Promise<CiphertextResponseDto> {
  const response = await apiFetch(
    `${API_BASE.password}/api/v1/passwords/ciphertext/${encodeURIComponent(passwordId)}?vaultId=${encodeURIComponent(vaultId)}`,
    { method: 'GET' }
  );

  return response.json();
}
