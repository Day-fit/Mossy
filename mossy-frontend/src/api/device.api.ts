import { apiFetch } from './client.ts';

type NonceResponse = { nonce: string };

export async function executeGenerateNonceRequest(): Promise<NonceResponse> {
	return await apiFetch('/api/v1/key-sync/nonce', {
		method: 'GET',
	}).then((res) => res.json());
}

export async function executeRegisterDeviceRequest(pkDh: string, pkId: string) {
	await apiFetch('/api/v1/key-sync/register', {
		method: 'POST',
		body: JSON.stringify({
			publicKeyDH: {
				kty: 'OKP',
				crv: 'X25519',
				publicKey: pkDh,
			},
			publicKeyID: {
				kty: 'OKP',
				crv: 'Ed25519',
				publicKey: pkId,
			},
		}),
	});
}
