import { motion } from 'framer-motion';
import type { UserVaultDto } from '../../api/vault.api.ts';

type PasswordVaultSelectorProps = {
	isLoadingVaults: boolean;
	vaults: UserVaultDto[];
	selectedVaultId: string;
	onSelect: (vaultId: string) => void;
};

export default function PasswordVaultSelector({
	isLoadingVaults,
	vaults,
	selectedVaultId,
	onSelect,
}: PasswordVaultSelectorProps) {
	return (
		<motion.section
			className="rounded-md bg-white p-4 shadow-md sm:p-5"
			initial={{ opacity: 0, y: 16 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.35, ease: 'easeOut' }}
		>
			<h2 className="mb-3 text-lg font-semibold text-gray-800 sm:text-xl">
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
						className={`rounded-md border px-3 py-2 text-xs sm:text-sm ${
							selectedVaultId === vault.vaultId
								? 'border-gray-900 bg-gray-900 text-white'
								: vault.isOnline
									? 'border-gray-300 bg-white text-gray-800'
									: 'border-red-200 bg-red-50 text-red-700'
						}`}
						onClick={() => onSelect(vault.vaultId)}
					>
						<span className="mr-2">{vault.vaultName}</span>
						<span className="text-[11px] opacity-80 sm:text-xs">
							{vault.isOnline ? 'Online' : 'Offline'}
						</span>
					</button>
				))}
			</div>
		</motion.section>
	);
}
