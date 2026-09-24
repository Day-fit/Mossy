import { motion } from 'framer-motion';
import VaultOptionsMenu from './VaultOptionsMenu.tsx';
import Button from '../shared/Button.tsx';

type VaultCardProps = {
    vaultId: string;
    vaultName: string;
    isOnline: boolean;
    lastSeenAt: string | null;
    onRename: () => void;
    onDelete: () => void;
};

function copyText(value: string) {
    void navigator.clipboard.writeText(value);
}

export default function VaultCard({
    vaultId,
    vaultName,
    isOnline,
    lastSeenAt,
    onRename,
    onDelete,
}: VaultCardProps) {
    const statusClassName = isOnline ? 'text-success' : 'text-danger';
    const formattedLastSeenAt = lastSeenAt
        ? new Date(lastSeenAt).toLocaleString()
        : 'Never';

    return (
        <motion.article
            className="rounded-xl border border-border bg-surface p-5 shadow-card"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                    <h3 className="text-xl">{vaultName}</h3>
                    <p className={`text-sm ${statusClassName}`}>
                        {isOnline ? 'Online' : 'Offline'}
                    </p>
                    <p className="text-xs text-fg-muted">
                        Last seen: {formattedLastSeenAt}
                    </p>
                </div>

                <VaultOptionsMenu
                    onRename={onRename}
                    onDelete={onDelete}
                    onCopyVaultId={() => copyText(vaultId)}
                />
            </div>

            <label className="mb-2 block text-xs font-semibold text-fg-muted">
                Vault ID
            </label>
            <div className="flex gap-2">
                <input
                    type="text"
                    value={vaultId}
                    readOnly
                    className="w-full rounded-md border border-border bg-surface-subtle px-3 py-2 font-mono text-xs text-fg-secondary"
                />
                <Button
                    type="button"
                    variant="outline"
                    className="text-sm"
                    onClick={() => copyText(vaultId)}
                >
                    Copy
                </Button>
            </div>
        </motion.article>
    );
}
