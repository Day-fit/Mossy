import type { PasswordMetadataDto } from '../../api/password.api.ts';

export function getSshKeyFilename(
	password: PasswordMetadataDto,
	keyType: 'private' | 'public'
) {
	const fallback = password.passwordId;
	const rawName = password.identifier || password.address || fallback;
	const safeName =
		rawName
			.trim()
			.replace(/[^a-zA-Z0-9._-]+/g, '-')
			.replace(/^-+|-+$/g, '') || fallback;

	if (keyType === 'public') {
		return safeName.endsWith('.pub') ? safeName : `${safeName}.pub`;
	}

	return safeName.endsWith('.key') || safeName.endsWith('.pem')
		? safeName
		: `${safeName}.key`;
}

export function downloadTextFile(filename: string, content: string) {
	const url = URL.createObjectURL(
		new Blob([content], { type: 'application/octet-stream' })
	);
	const link = document.createElement('a');

	link.href = url;
	link.download = filename;
	link.style.display = 'none';
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
}
