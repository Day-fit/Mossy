import { beforeAll, describe, expect, it } from 'vitest';
import sodium from 'libsodium-wrappers-sumo';
import {
	signKeySyncAuthTranscript,
	verifyKeySyncAuthTranscript,
} from './keySyncProtocol.ts';

describe('key-sync authentication transcript', () => {
	beforeAll(async () => {
		await sodium.ready;
	});

	it('verifies a DH key signed by the claimed device identity', async () => {
		const identity = sodium.crypto_sign_keypair();
		const dh = sodium.crypto_box_keypair();
		const publicDh = sodium.to_base64(
			dh.publicKey,
			sodium.base64_variants.URLSAFE_NO_PADDING
		);
		const privateIdentity = sodium.to_base64(
			identity.privateKey,
			sodium.base64_variants.URLSAFE_NO_PADDING
		);
		const publicIdentity = sodium.to_base64(
			identity.publicKey,
			sodium.base64_variants.URLSAFE_NO_PADDING
		);
		const signature = await signKeySyncAuthTranscript(
			'SENDER',
			'123456',
			'device-1',
			publicDh,
			privateIdentity
		);

		await expect(
			verifyKeySyncAuthTranscript(
				'SENDER',
				'123456',
				'device-1',
				publicDh,
				signature,
				publicIdentity
			)
		).resolves.toBe(true);
	});

	it('rejects replay into a different room, role, or device identity', async () => {
		const identity = sodium.crypto_sign_keypair();
		const dh = sodium.crypto_box_keypair();
		const publicDh = sodium.to_base64(
			dh.publicKey,
			sodium.base64_variants.URLSAFE_NO_PADDING
		);
		const privateIdentity = sodium.to_base64(
			identity.privateKey,
			sodium.base64_variants.URLSAFE_NO_PADDING
		);
		const publicIdentity = sodium.to_base64(
			identity.publicKey,
			sodium.base64_variants.URLSAFE_NO_PADDING
		);
		const signature = await signKeySyncAuthTranscript(
			'SENDER',
			'123456',
			'device-1',
			publicDh,
			privateIdentity
		);

		await expect(
			verifyKeySyncAuthTranscript(
				'RECEIVER',
				'654321',
				'device-2',
				publicDh,
				signature,
				publicIdentity
			)
		).resolves.toBe(false);
	});
});
