import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MdCloudOff, MdOpenInNew } from 'react-icons/md';
import { type UserVaultDto } from '../../api/vault.api.ts';
import VaultSelectorCard from './VaultSelectorCard.tsx';
import PasswordListCard from './PasswordListCard.tsx';
import { useVaultStore } from '../../store/vaultStore.ts';
import Button from '../shared/Button.tsx';

export default function PasswordHero() {
    const {
        selectedVaultId,
        setSelectedVaultId,
        vaults,
        refreshVaults,
        isLoading,
        errorOccurred,
    } = useVaultStore();
    const reduceMotion = useReducedMotion();

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
                <section className="rounded-md bg-surface p-5 shadow-card">
                    <p className="text-sm text-fg-muted">
                        Select a vault above to manage passwords.
                    </p>
                </section>
            ) : null}

            {selectedVaultId && selectedVault && !selectedVault.isOnline ? (
                <motion.section
                    className="rounded-md bg-surface p-6 shadow-card sm:p-8"
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    aria-labelledby="offline-vault-title"
                >
                    <MdCloudOff
                        className="mb-4 text-warning"
                        size={32}
                        aria-hidden="true"
                    />
                    <h2 id="offline-vault-title" className="mb-2 text-xl">
                        {selectedVault.vaultName} is offline
                    </h2>
                    <p className="max-w-lg text-sm leading-relaxed text-fg-secondary">
                        Your self-hosted vault is disconnected. Start the vault
                        and its database, then refresh its status here to manage
                        passwords.
                    </p>
                    <div className="mt-5 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                        <a
                            href="https://github.com/Day-fit/Mossy#run-only-the-vault-probably-what-you-are-looking-for"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-sm text-sm font-semibold text-brand underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                        >
                            How to start your vault
                            <MdOpenInNew size={16} aria-hidden="true" />
                        </a>
                        <Button
                            type="button"
                            variant="outline"
                            padding="medium"
                            className="text-sm"
                            disabled={isLoading}
                            onClick={() => void refreshVaults()}
                        >
                            {isLoading ? 'Checking status…' : 'Refresh status'}
                        </Button>
                    </div>
                    {errorOccurred && (
                        <p role="alert" className="mt-4 text-sm text-danger">
                            Could not refresh the vault status. Try again.
                        </p>
                    )}
                </motion.section>
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
