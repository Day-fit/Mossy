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
                className="min-w-0 rounded-xl border border-border bg-surface shadow-control p-5 max-[400px]:p-4"
                aria-labelledby="offline-vault-title"
                aria-busy={loading}
            >
                <MdCloudOff
                    className="mb-3.5 text-fg-warning"
                    size={32}
                    aria-hidden="true"
                />
                <h2
                    className="text-lg leading-[1.4] mb-2 [overflow-wrap:anywhere]"
                    id="offline-vault-title"
                >
                    {vault.vaultName} is{' '}
                    {unavailable ? 'unavailable' : 'offline'}
                </h2>
                <p className="text-[0.8125rem] leading-[1.6] text-fg-secondary">
                    {unavailable
                        ? 'Mossy could not connect to this vault. Check that the vault and its database are running, then refresh its status.'
                        : 'Your self-hosted vault is disconnected. Start the vault and its database, then refresh its status here to manage passwords.'}
                </p>
                {vault.lastSeenAt && (
                    <p className="leading-[1.6] mt-2.5 text-xs text-fg-muted">
                        Last connected:{' '}
                        {new Date(vault.lastSeenAt).toLocaleString()}.
                    </p>
                )}
                <div className="mt-5 flex flex-wrap items-center gap-3.5">
                    <Button
                        className="inline-flex items-center justify-center gap-[7px] whitespace-nowrap font-semibold [&_svg]:shrink-0 disabled:cursor-not-allowed disabled:opacity-55 motion-safe:enabled:active:scale-[0.98] min-h-10 text-[0.8125rem] cursor-pointer"
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
                        className="text-fg-brand underline-offset-3 hover:text-fg-brand-hover hover:underline inline-flex items-center gap-[5px] text-xs font-semibold"
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
