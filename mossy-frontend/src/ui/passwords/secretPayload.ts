import type { PasswordFormState } from './index.ts';

export type PasswordSecretPayload = {
	kind: 'PASSWORD';
	password: string;
};

export type SshSecretPayload = {
	kind: 'SSH';
	privateKey: string;
	publicKey: string;
};

export type SecretPayload = PasswordSecretPayload | SshSecretPayload;

const PRIVATE_KEY_PATTERN =
	/-----BEGIN (OPENSSH|RSA|DSA|EC|ENCRYPTED|) ?PRIVATE KEY-----[\s\S]+-----END \1 ?PRIVATE KEY-----/;

const PUBLIC_KEY_PATTERN =
	/^(ssh-(rsa|ed25519)|ecdsa-sha2-nistp(256|384|521)|sk-ssh-ed25519@openssh\.com|sk-ecdsa-sha2-nistp256@openssh\.com) [A-Za-z0-9+/]+={0,3}( .*)?$/;

function asObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

export function validateSshKeyPair(privateKey: string, publicKey: string) {
	const trimmedPrivateKey = privateKey.trim();
	const trimmedPublicKey = publicKey.trim();

	if (!trimmedPrivateKey) {
		return 'Private SSH key is required.';
	}

	if (!PRIVATE_KEY_PATTERN.test(trimmedPrivateKey)) {
		return 'Private SSH key must be an OpenSSH or PEM private key.';
	}

	if (!trimmedPublicKey) {
		return 'Public SSH key is required.';
	}

	if (!PUBLIC_KEY_PATTERN.test(trimmedPublicKey)) {
		return 'Public SSH key must be an OpenSSH public key.';
	}

	return null;
}

export function toSecretPayload(formState: PasswordFormState): SecretPayload {
	if (formState.passwordType === 'SSH_KEY') {
		const validationMessage = validateSshKeyPair(
			formState.privateKey,
			formState.publicKey
		);

		if (validationMessage) {
			throw new Error(validationMessage);
		}

		return {
			kind: 'SSH',
			privateKey: formState.privateKey.trim(),
			publicKey: formState.publicKey.trim(),
		};
	}

	return {
		kind: 'PASSWORD',
		password: formState.password,
	};
}

export function serializeSecretPayload(formState: PasswordFormState) {
	return JSON.stringify(toSecretPayload(formState));
}

export function parseSecretPayload(
	decrypted: string
): SecretPayload {
	const parsed: unknown = JSON.parse(decrypted);

	if (
		asObject(parsed) &&
		parsed.kind === 'PASSWORD' &&
		typeof parsed.password === 'string'
	) {
		return {
			kind: 'PASSWORD',
			password: parsed.password,
		};
	}

	if (
		asObject(parsed) &&
		parsed.kind === 'SSH' &&
		typeof parsed.privateKey === 'string' &&
		typeof parsed.publicKey === 'string'
	) {
		return {
			kind: 'SSH',
			privateKey: parsed.privateKey,
			publicKey: parsed.publicKey,
		};
	}

	throw new Error('Unsupported secret payload format');
}
