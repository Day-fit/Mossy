import type { PasswordType } from '../../api/password.api.ts';

export type CiphertextPhase = 'Fetching' | 'Decrypting';
export type PasswordFormState = {
	identifier: string;
	address: string;
	password: string;
	passwordType: PasswordType;
};
export type SavePasswordResult = 'saved' | 'deferred' | 'failed';
export type StatusMessage =
	| { type: 'success'; message: string }
	| { type: 'error'; message: string }
	| null;
