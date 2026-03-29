import { z } from 'zod';

export const emailConfirmationSchema = z.object({
	code: z
		.string()
		.length(6, 'PIN must be 6 digits long')
		.regex(/^[0-9]+$/, 'PIN must contain only digits'),
});

export type EmailConfirmationSchema = z.infer<typeof emailConfirmationSchema>;
