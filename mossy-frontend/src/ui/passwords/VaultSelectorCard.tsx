import type { UserVaultDto } from '../../api/vault.api.ts';

type VaultSelectorProps = {
	vaults: UserVaultDto[];
	selectedVaultId: string;
	isLoadingVaults: boolean;
	onSelectVault: (vault: UserVaultDto) => void;
};

function VaultSelectorCard({
	vaults,
	selectedVaultId,
	isLoadingVaults,
	onSelectVault,
}: VaultSelectorProps) {
	return (
		<section className="mb-6 rounded-md bg-white p-5 shadow-md">
			<h2 className="mb-3 text-xl font-semibold text-gray-800">
				Select vault
			</h2>
			{isLoadingVaults ? (
				<p className="text-sm text-gray-500">Loading vaults...</p>
			) : null}
			{!isLoadingVaults && vaults.length === 0 ? (
				<p className="text-sm text-gray-500">No vaults available</p>
			) : null}

			<div className="flex flex-wrap gap-2">
				{vaults.map((vault) => (
					<button
						key={vault.vaultId}
						type="button"
						className={`rounded-md border px-3 py-2 text-sm ${
							selectedVaultId === vault.vaultId
								? 'border-gray-900 bg-gray-900 text-white'
								: vault.isOnline
									? 'border-gray-300 bg-white text-gray-800'
									: 'border-red-200 bg-red-50 text-red-700'
						}`}
						onClick={() => onSelectVault(vault)}
					>
						<span className="mr-2">{vault.vaultName}</span>
						<span className="text-xs opacity-80">
							{vault.isOnline ? 'Online' : 'Offline'}
						</span>
					</button>
				))}
			</div>
		</section>
	);
}

export default VaultSelectorCard;
