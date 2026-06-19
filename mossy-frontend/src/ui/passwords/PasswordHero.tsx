import { useEffect } from 'react';
import { type UserVaultDto } from '../../api/vault.api.ts';
import VaultSelectorCard from './VaultSelectorCard.tsx';
import PasswordListCard from './PasswordListCard.tsx';
import { useVault } from '../../hooks/useVault.ts';
import { useVaultStore } from '../../store/vaultStore.ts';

export default function PasswordHero() {
	const { selectedVaultId, setSelectedVaultId } = useVaultStore();
	const { vaults, refreshVaults } = useVault();

	const selectedVault =
		vaults.find((v) => v.vaultId === selectedVaultId) ?? null;

	const canManagePasswords = Boolean(
		selectedVaultId && selectedVault?.isOnline
	);

	useEffect(() => {
		if (vaults.length === 0 || selectedVaultId) return;

		const initial = vaults.find((v) => v.isOnline) ?? vaults[0];
		if (!initial) return;

		setSelectedVaultId(initial.vaultId);
	}, [vaults, selectedVaultId, setSelectedVaultId]);

	const handleVaultSelect = async (vault: UserVaultDto) => {
		setSelectedVaultId(vault.vaultId);
	};

	return (
		<section className="w-full p-5 flex flex-col gap-6">
			<VaultSelectorCard
				vaults={vaults}
				selectedVaultId={selectedVaultId}
				onSelectVault={(vault) => void handleVaultSelect(vault)}
			/>

			{!selectedVaultId ? (
				<section className="rounded-md bg-white p-5 shadow-md">
					<p className="text-sm text-gray-600">
						Select a vault above to manage passwords.
					</p>
				</section>
			) : null}

			{selectedVaultId && selectedVault && !selectedVault.isOnline ? (
				<section className="rounded-md bg-white p-5 shadow-md">
					<p className="text-sm text-gray-600">
						Selected vault is offline. Connect the vault to manage
						passwords.
					</p>
				</section>
			) : null}

			{canManagePasswords ? (
				<div className="flex flex-col gap-6">
					<PasswordListCard
						vaultId={selectedVaultId}
						isVaultOnline={Boolean(selectedVault?.isOnline)}
						refreshVaults={refreshVaults}
					/>
				</div>
			) : null}
		</section>
	);
}
