import { apiFetch } from './client';
import { API_BASE } from '../utils/constants';

export type RegisterDeviceResponse = {
  deviceId: string;
  requiresSync: boolean;
  syncCode: string | null;
};

export async function executeGenerateNonceRequest(deviceId: string): Promise<{ nonce: string }> {
  return apiFetch(`${API_BASE.device}/api/v1/key-sync/nonce`, {
    method: 'GET',
    headers: { 'X-Device-ID': deviceId },
  }).then((res) => res.json());
}

export async function executeRegisterDeviceRequest(pkId: string): Promise<RegisterDeviceResponse> {
  const response = await apiFetch(`${API_BASE.device}/api/v1/device/register`, {
    method: 'POST',
    body: JSON.stringify({
      publicKeyId: {
        kty: 'OKP',
        crv: 'Ed25519',
        x: pkId,
      },
    }),
  });
  return response.json();
}

export async function executeInitKeySyncRequest(deviceId: string, vaultId: string): Promise<{ code: string }> {
  return apiFetch(`${API_BASE.device}/api/v1/key-sync/init`, {
    method: 'POST',
    headers: { 'X-Device-ID': deviceId },
    body: JSON.stringify({ vaultId }),
  }).then((res) => res.json());
}
