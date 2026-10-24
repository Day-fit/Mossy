import { Button } from '@mossy/ui';
import { MdCloudOff, MdOpenInNew, MdRefresh } from 'react-icons/md';
import type { Vault } from '../../types/models';
import ViewTransition from '../shared/ViewTransition';

export default function OfflineVault({
    vault,
    unavailable,
    loading,
    onRefresh,
}: {
    vault: Vault;
    unavailable: boolean;
    loading: boolean;
    onRefresh: () => void;
}) {
    return (
        <ViewTransition viewKey={vault.vaultId}>
            <section
                className="panel offline-vault"
                aria-labelledby="offline-vault-title"
                aria-busy={loading}
            >
                <MdCloudOff size={32} aria-hidden="true" />
                <h2 id="offline-vault-title">
                    {vault.vaultName} is{' '}
                    {unavailable ? 'unavailable' : 'offline'}
                </h2>
                <p>
                    {unavailable
                        ? 'Mossy could not connect to this vault. Check that the vault and its database are running, then refresh its status.'
                        : 'Your self-hosted vault is disconnected. Start the vault and its database, then refresh its status here to manage passwords.'}
                </p>
                {vault.lastSeenAt && (
                    <p className="muted">
                        Last connected:{' '}
                        {new Date(vault.lastSeenAt).toLocaleString()}.
                    </p>
                )}
                <div className="offline-actions">
                    <Button
                        type="button"
                        variant="outline"
                        padding="medium"
                        disabled={loading}
                        onClick={onRefresh}
                    >
                        <MdRefresh size={18} aria-hidden="true" />
                        {loading ? 'Checking status…' : 'Refresh status'}
                    </Button>
                    <a
                        href="https://github.com/Day-fit/Mossy#run-only-the-vault-probably-what-you-are-looking-for"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        How to start your vault{' '}
                        <MdOpenInNew size={15} aria-hidden="true" />
                    </a>
                </div>
            </section>
        </ViewTransition>
    );
}
