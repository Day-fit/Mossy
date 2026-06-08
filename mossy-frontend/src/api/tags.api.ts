import { apiFetch } from './client.ts';

export type AssignTagRequestDto = {
	passwordId: string;
	vaultId: string;
	tagId: string;
};

export type CreateTagRequestDto = {
	vaultId: string;
	tagName: string;
	color: string;
};

export type GetTagsResponseDto = {
	color: string;
	tagName: string;
	tagId: string;
};

export async function executeGetTagsRequest(
	vaultId: string
): Promise<GetTagsResponseDto[]> {
	try {
		return await apiFetch(`/api/v1/passwords/vault/${vaultId}/tags`, {
			method: 'GET',
		}).then((res) => res.json());
	} catch (e) {
		throw e;
	}
}

export async function executeCreateTagRequest({
	vaultId,
	tagName,
	color,
}: CreateTagRequestDto): Promise<void> {
	await apiFetch(`/api/v1/passwords/tag`, {
		method: 'POST',
		body: JSON.stringify({
			vaultId: vaultId,
			tagName: tagName,
			color: color,
		}),
	});
}

export async function executeAssignTagRequest({
	vaultId,
	tagId,
	passwordId,
}: AssignTagRequestDto): Promise<void> {
	await apiFetch(`/api/v1/passwords/${passwordId}/tags`, {
		method: 'PUT',
		body: JSON.stringify({
			vaultId: vaultId,
			tagId: tagId,
		}),
	});
}
