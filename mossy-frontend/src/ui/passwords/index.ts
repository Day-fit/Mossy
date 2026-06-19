import type { PasswordType } from '../../api/password.api.ts';

export type CiphertextPhase = 'Fetching' | 'Decrypting';
type PasswordBaseFormState = {
	identifier: string;
	address: string;
	passwordType: PasswordType;
};
export type PasswordFormState =
	| (PasswordBaseFormState & {
			passwordType: 'PASSWORD';
			password: string;
	  })
	| (PasswordBaseFormState & {
			passwordType: 'SSH_KEY';
			privateKey: string;
			publicKey?: string;
	  });
export type SavePasswordResult = 'saved' | 'deferred' | 'failed';
export type StatusMessage =
	| { type: 'success'; message: string }
	| { type: 'error'; message: string }
	| null;
