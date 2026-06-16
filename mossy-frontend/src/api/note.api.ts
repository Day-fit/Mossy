import { apiFetch } from './client.ts';

type GetNoteResponseDto = {
	content: string;
};

export async function executeSaveNoteRequest(
	vaultId: string,
	passwordId: string,
	encryptedNote: string
): Promise<Response> {
	return apiFetch(
		`/api/v1/passwords/vault/${vaultId}/password/${passwordId}/note`,
		{
			method: 'POST',
			body: JSON.stringify({
				content: encryptedNote,
			}),
		}
	);
}

export async function executeGetNoteRequest(
	vaultId: string,
	passwordId: string
): Promise<GetNoteResponseDto> {
	const res = await apiFetch(
		`/api/v1/passwords/vault/${vaultId}/password/${passwordId}/note`,
		{
			method: 'GET',
		}
	);

	return res.json();
}
