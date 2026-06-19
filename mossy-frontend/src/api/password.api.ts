import { apiFetch } from './client.ts';
import {
	savePasswordRequestSchema,
	updatePasswordRequestSchema,
} from '../forms/passwordSchema.ts';

export type SavePasswordRequestDto = {
	identifier: string;
	address: string;
	cipherText: string;
	vaultId: string;
	passwordType: PasswordType;
};

export type UpdatePasswordRequestDto = {
	passwordId: string;
	identifier: string;
	address: string;
	cipherText: string;
	vaultId: string;
};

export type DeletePasswordRequestDto = {
	passwordId: string;
	vaultId: string;
};

export type PasswordMetadataDto = {
	passwordId: string;
	identifier: string;
	address: string;
	lastModified: string;
	hasNote: boolean;
	tags: TagDto[];
	passwordType: PasswordType;
};

export type PasswordType = 'PASSWORD' | 'SSH_KEY';

export type TagDto = {
	tagId: string;
	tagName: string;
	color: string;
};

export type CiphertextResponseDto = {
	ciphertext: string;
	passwordId: string;
	type: 'CIPHERTEXT_RETRIEVAL';
};

export type ServerResponseDto = {
	message: string;
};

function firstValidationMessage(
	result:
		| ReturnType<typeof savePasswordRequestSchema.safeParse>
		| ReturnType<typeof updatePasswordRequestSchema.safeParse>
) {
	return result.success
		? null
		: (result.error.issues[0]?.message ?? 'Invalid password request');
}

export async function executeSavePasswordRequest(
	payload: SavePasswordRequestDto
): Promise<ServerResponseDto> {
	const validation = savePasswordRequestSchema.safeParse(payload);
	const validationMessage = firstValidationMessage(validation);
	if (validationMessage) throw new Error(validationMessage);

	const response = await apiFetch('/api/v1/passwords/save', {
		method: 'POST',
		body: JSON.stringify(validation.data),
	});

	return response.json();
}

export async function executeUpdatePasswordRequest(
	payload: UpdatePasswordRequestDto
): Promise<ServerResponseDto> {
	const validation = updatePasswordRequestSchema.safeParse(payload);
	const validationMessage = firstValidationMessage(validation);
	if (validationMessage) throw new Error(validationMessage);

	const response = await apiFetch('/api/v1/passwords/update', {
		method: 'PATCH',
		body: JSON.stringify(validation.data),
	});

	return response.json();
}

export async function executeDeletePasswordRequest(
	payload: DeletePasswordRequestDto
): Promise<ServerResponseDto> {
	const response = await apiFetch('/api/v1/passwords/delete', {
		method: 'DELETE',
		body: JSON.stringify(payload),
	});

	return response.json();
}

export async function executePasswordMetadataRequest(
	vaultId: string
): Promise<PasswordMetadataDto[]> {
	const response = await apiFetch(
		`/api/v1/passwords/metadata?vaultId=${encodeURIComponent(vaultId)}`,
		{
			method: 'GET',
		}
	);

	return response.json();
}

export async function executePasswordCiphertextRequest(
	passwordId: string,
	vaultId: string
): Promise<CiphertextResponseDto> {
	const response = await apiFetch(
		`/api/v1/passwords/ciphertext/${encodeURIComponent(passwordId)}?vaultId=${encodeURIComponent(vaultId)}`,
		{
			method: 'GET',
		}
	);

	return response.json();
}
