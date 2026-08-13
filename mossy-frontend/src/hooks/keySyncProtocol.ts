import sodium from 'libsodium-wrappers-sumo';

export type KeySyncRole = 'SENDER' | 'RECEIVER';

const AUTH_TRANSCRIPT_DOMAIN = 'mossy-key-sync-auth-v1';

async function buildKeySyncAuthTranscript(
	role: KeySyncRole,
	syncCode: string,
	deviceId: string,
	publicDhKey: string
): Promise<Uint8Array> {
	await sodium.ready;

	const context = sodium.from_string(
		`${AUTH_TRANSCRIPT_DOMAIN}\0${role}\0${syncCode}\0${deviceId}\0`
	);
	const dhKey = sodium.from_base64(
		publicDhKey,
		sodium.base64_variants.URLSAFE_NO_PADDING
	);
	const transcript = new Uint8Array(context.length + dhKey.length);
	transcript.set(context);
	transcript.set(dhKey, context.length);
	return transcript;
}

export async function signKeySyncAuthTranscript(
	role: KeySyncRole,
	syncCode: string,
	deviceId: string,
	publicDhKey: string,
	privateIdentityKey: string
): Promise<string> {
	const transcript = await buildKeySyncAuthTranscript(
		role,
		syncCode,
		deviceId,
		publicDhKey
	);
	const privateKey = sodium.from_base64(
		privateIdentityKey,
		sodium.base64_variants.URLSAFE_NO_PADDING
	);

	return sodium.to_base64(
		sodium.crypto_sign_detached(transcript, privateKey),
		sodium.base64_variants.URLSAFE_NO_PADDING
	);
}

export async function verifyKeySyncAuthTranscript(
	role: KeySyncRole,
	syncCode: string,
	deviceId: string,
	publicDhKey: string,
	signature: string,
	publicIdentityKey: string
): Promise<boolean> {
	const transcript = await buildKeySyncAuthTranscript(
		role,
		syncCode,
		deviceId,
		publicDhKey
	);
	const signatureBytes = sodium.from_base64(
		signature,
		sodium.base64_variants.URLSAFE_NO_PADDING
	);
	const identityKey = sodium.from_base64(
		publicIdentityKey,
		sodium.base64_variants.URLSAFE_NO_PADDING
	);

	return sodium.crypto_sign_verify_detached(
		signatureBytes,
		transcript,
		identityKey
	);
}
