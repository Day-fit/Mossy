import { apiFetch } from './client.ts';

type NonceResponse = { nonce: string };

export type RegisterDeviceResponse = {
	deviceId: string;
	requiresSync: boolean;
	syncCode: string | null;
};

export async function executeGenerateNonceRequest(
	deviceId: string
): Promise<NonceResponse> {
	return await apiFetch('/api/v1/key-sync/nonce', {
		method: 'GET',
		headers: {
			'X-Device-ID': deviceId,
		},
	}).then((res) => res.json());
}

export async function executeRegisterDeviceRequest(
	pkId: string
): Promise<RegisterDeviceResponse> {
	const response = await apiFetch('/api/v1/device/register', {
		method: 'POST',
		body: JSON.stringify({
			publicKeyId: {
				kty: 'OKP',
				crv: 'Ed25519',
				x: pkId,
			},
		}),
	});
	return (await response.json()) as RegisterDeviceResponse;
}

export async function executeInitKeySyncRequest(
	deviceId: string
): Promise<{ code: string }> {
	return await apiFetch('/api/v1/key-sync/init', {
		method: 'POST',
		headers: {
			'X-Device-ID': deviceId,
		},
	}).then((res) => res.json());
}
