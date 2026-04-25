export class PinNotFoundException extends Error {
	private readonly _vaultId: string;

	constructor(vaultId: string, message?: string) {
		super(message ?? `Key not found in vault: ${vaultId}`);
		this.name = 'KeyNotFoundException';
		this._vaultId = vaultId;
	}

	get vaultId(): string {
		return this._vaultId;
	}
}
