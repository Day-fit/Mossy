import { z } from 'zod';

export const encryptionPinSchema = z.object({
	pin: z
		.string()
		.length(4, { message: 'Pin must be 4 digits' })
		.regex(/^[0-9]+$/, 'Code must contain only digits'),
});

export type EncryptionPinSchema = z.infer<typeof encryptionPinSchema>;
