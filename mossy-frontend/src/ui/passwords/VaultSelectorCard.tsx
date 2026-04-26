import type { UserVaultDto } from '../../api/vault.api.ts';

type VaultSelectorProps = {
	vaults: UserVaultDto[];
	selectedVaultId: string;
	onSelectVault: (vault: UserVaultDto) => void;
};

function VaultSelectorCard({
	vaults,
	selectedVaultId,
	onSelectVault,
}: VaultSelectorProps) {
	return (
		<section className="rounded-xl p-6 shadow-sm bg-white">
			<div className="mb-5 flex items-center justify-between">
				<h2 className="text-lg font-semibold text-emerald-900">
					Vaults
				</h2>

				<span className="text-xs text-emerald-700/70">
					{vaults.length} total
				</span>
			</div>

			{vaults.length === 0 ? (
				<div className="rounded-lg border border-dashed border-emerald-200 bg-white p-4 text-sm text-emerald-700/70">
					No vaults available
				</div>
			) : (
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{vaults.map((vault) => {
						const isSelected = selectedVaultId === vault.vaultId;

						return (
							<button
								key={vault.vaultId}
								type="button"
								onClick={() => onSelectVault(vault)}
								className={[
									'relative w-full rounded-xl border p-4 text-left transition',
									'hover:shadow-md active:scale-[0.99]',
									isSelected
										? 'border-emerald-900 bg-emerald-900 text-white'
										: vault.isOnline
											? 'border-emerald-200 bg-white text-emerald-950 hover:border-emerald-300'
											: 'border-red-100 bg-red-50 text-red-700 hover:border-red-200',
								].join(' ')}
							>
								<div className="flex items-start justify-between gap-3">
									<div>
										<p className="text-sm font-semibold">
											{vault.vaultName}
										</p>

										<p className="mt-1 text-xs opacity-70">
											{vault.passwordCount} passwords
										</p>
									</div>
								</div>

								<div className="mt-3 flex items-center justify-between text-[11px] opacity-80">
									<div className="flex items-center gap-2">
										<span
											className={[
												'h-2.5 w-2.5 rounded-full',
												vault.isOnline
													? 'bg-emerald-500'
													: 'bg-red-400',
											].join(' ')}
										/>
										<span>
											{vault.isOnline
												? 'Online'
												: 'Offline'}
										</span>
									</div>

									<span>
										{vault.lastSeenAt
											? new Date(
													vault.lastSeenAt
												).toLocaleString()
											: '—'}
									</span>
								</div>

								{isSelected && (
									<div className="absolute right-3 top-3 h-2 w-2 rounded-full bg-white" />
								)}
							</button>
						);
					})}
				</div>
			)}
		</section>
	);
}

export default VaultSelectorCard;
