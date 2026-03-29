import { z } from 'zod';

export const registerSchema = z.object({
	username: z
		.string()
		.min(3, 'Username must be at least 3 characters long')
		.max(20, 'Username must be at most 20 characters long'),
	email: z.email('Email must be valid'),
	password: z.string().min(8, 'Password must be at least 8 characters long'),
});

export type RegisterSchema = z.infer<typeof registerSchema>;
