export type CiphertextPhase = 'Fetching' | 'Decrypting';
export type PasswordFormState = {
	identifier: string;
	domain: string;
	password: string;
};
export type StatusMessage =
	| { type: 'success'; message: string }
	| { type: 'error'; message: string }
	| null;
