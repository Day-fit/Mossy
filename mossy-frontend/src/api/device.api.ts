import { apiFetch } from './client.ts';

type DeviceIdentityKeyResponse = {
	kty: 'OKP';
	crv: 'Ed25519';
	x: string;
};

export async function executeInitKeySyncRequest(
	vaultId: string
): Promise<{ code: string }> {
	return await apiFetch('/api/v1/key-sync/init', {
		method: 'POST',
		body: JSON.stringify({
			vaultId: vaultId,
		}),
	}).then((res) => res.json());
}

export async function executeGetDeviceIdentityKeyRequest(
	deviceId: string
): Promise<DeviceIdentityKeyResponse> {
	return await apiFetch(
		`/api/v1/device-trust/device/${encodeURIComponent(deviceId)}/identity-key`
	).then((res) => res.json());
}
