import type { UserVaultDto } from '../../api/vault.api.ts';
import { GoCheckCircleFill } from 'react-icons/go';
import { motion } from 'framer-motion';
import { resolveGlobalStyleToken } from '../../theme/globalTokens.ts';

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
        <section className="rounded-xl p-6 shadow-control bg-surface-card">
            <div className="mb-5 flex items-center justify-between">
                <h2 className="type-component-title text-brand">Vaults</h2>

                <span className="type-caption text-brand/70">
                    {vaults.length} total
                </span>
            </div>

            {vaults.length === 0 ? (
                <div className="rounded-lg border border-dashed border-brand-muted bg-surface-card p-4 type-body-sm text-brand/70">
                    No vaults available
                </div>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {vaults.map((vault) => {
                        const isSelected = selectedVaultId === vault.vaultId;

                        return (
                            <motion.button
                                key={vault.vaultId}
                                type="button"
                                onClick={() => onSelectVault(vault)}
                                aria-pressed={isSelected}
                                whileHover={{
                                    boxShadow:
                                        resolveGlobalStyleToken('cardShadow'),
                                }}
                                whileTap={{ scale: 0.99 }}
                                transition={{ duration: 0.15 }}
                                className={[
                                    'relative w-full rounded-xl border p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
                                    isSelected
                                        ? 'border-brand bg-brand text-fg-inverse'
                                        : vault.isOnline
                                          ? 'border-brand-muted bg-surface-card text-brand hover:border-brand-muted'
                                          : 'border-danger-border bg-danger-subtle text-danger hover:border-danger-border',
                                ].join(' ')}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="type-label">
                                            {vault.vaultName}
                                        </p>

                                        <p className="mt-1 type-caption opacity-70">
                                            {vault.passwordCount} passwords
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-3 flex items-center justify-between type-caption opacity-80">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={[
                                                'h-2.5 w-2.5 rounded-full',
                                                vault.isOnline
                                                    ? 'bg-success'
                                                    : 'bg-danger',
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
                                    <div className="absolute right-3 top-3">
                                        <GoCheckCircleFill
                                            className="text-xl text-brand-muted"
                                            aria-hidden="true"
                                        />
                                    </div>
                                )}
                            </motion.button>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

export default VaultSelectorCard;
