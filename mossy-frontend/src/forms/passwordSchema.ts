import { z } from 'zod';

export const MAX_PASSWORD_CIPHERTEXT_LENGTH = 102_400;

const passwordCipherTextSchema = z
	.string()
	.max(
		MAX_PASSWORD_CIPHERTEXT_LENGTH,
		`Encrypted password data cannot be longer than ${MAX_PASSWORD_CIPHERTEXT_LENGTH} characters`
	);

export const savePasswordRequestSchema = z.object({
	identifier: z.string().min(1, 'Identifier is required'),
	address: z.string().min(1, 'Address is required'),
	cipherText: passwordCipherTextSchema,
	vaultId: z.uuid('Vault id must be valid'),
	passwordType: z.enum(['PASSWORD', 'SSH_KEY']),
});

export const updatePasswordRequestSchema = savePasswordRequestSchema
	.omit({ passwordType: true })
	.extend({
		passwordId: z.uuid('Password id must be valid'),
	});
