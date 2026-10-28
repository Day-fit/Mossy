import { motion, useReducedMotion } from 'framer-motion';
import { MdCheckCircle, MdKey, MdStorage } from 'react-icons/md';
import type { PopupView } from './types';

type VaultSelectorProps = {
    view: Pick<
        PopupView,
        'vaults' | 'selected' | 'hasVaultKey' | 'vaultUnavailable'
    >;
    pending: boolean;
    loading: boolean;
    onSelect: (vaultId: string) => void;
    onReceiveKey: () => void;
};

export default function VaultSelector({
    view,
    pending,
    loading,
    onSelect,
    onReceiveKey,
}: VaultSelectorProps) {
    const reduce = useReducedMotion();
    if (!view.vaults.length) return null;
    const selectedVault = view.vaults.find(
        (vault) => vault.vaultId === view.selected
    );
    const offline =
        !!view.vaultUnavailable ||
        (selectedVault?.isOnline ?? selectedVault?.online) === false;
    return (
        <section
            className="min-w-0 rounded-xl border border-border bg-surface shadow-control p-5 max-[400px]:p-4"
            aria-labelledby="vault-heading"
        >
            <div className="mb-3 flex items-center justify-between gap-3">
                <h2
                    className="text-lg leading-[1.4] flex items-center gap-2 [&>svg]:text-fg-brand"
                    id="vault-heading"
                >
                    <MdStorage size={20} aria-hidden="true" /> Vaults
                </h2>
                <span className="text-xs whitespace-nowrap text-fg-muted">
                    {view.vaults.length} total
                </span>
            </div>
            {pending && (
                <p className="leading-[1.6] -mt-1 mb-3 text-xs text-fg-muted">
                    Choose where to save this login.
                </p>
            )}
            <div
                className="vault-choices -m-[3px] grid max-h-44 grid-cols-2 gap-2 overflow-y-auto p-[3px] max-[400px]:max-h-40 max-[400px]:grid-cols-1 [scrollbar-width:thin] [scrollbar-color:var(--color-border-strong)_transparent]"
                role="group"
                aria-label="Vault"
            >
                {view.vaults.map((vault) => {
                    const selected = vault.vaultId === view.selected;
                    const online = vault.isOnline ?? vault.online;
                    return (
                        <motion.button
                            key={vault.vaultId}
                            type="button"
                            className={`inline-flex min-h-[68px] cursor-pointer items-center justify-start gap-[7px] rounded-[9px] border p-3 text-left text-[0.8125rem] font-semibold whitespace-normal hover:border-fg-brand disabled:cursor-not-allowed disabled:opacity-55 [&>svg]:shrink-0 motion-safe:transition-[transform,background-color,border-color,color] ${selected ? 'border-brand bg-brand text-fg-inverse' : online === false ? 'border-[color-mix(in_srgb,var(--color-fg-warning)_30%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-fg-warning)_5%,var(--color-surface))] text-fg-secondary' : 'border-border bg-surface-subtle text-fg-secondary'}`}
                            aria-pressed={selected}
                            aria-label={vault.vaultName}
                            data-online={online === false ? 'false' : undefined}
                            disabled={loading}
                            onClick={() => onSelect(vault.vaultId)}
                            whileTap={reduce ? undefined : { scale: 0.98 }}
                        >
                            <MdStorage size={19} aria-hidden="true" />
                            <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                                <strong className="text-[0.8125rem] [overflow-wrap:anywhere]">
                                    {vault.vaultName}
                                </strong>
                                <span className="text-[0.6875rem] font-normal">
                                    {selected && view.vaultUnavailable
                                        ? 'Unavailable'
                                        : online === undefined
                                          ? 'Vault'
                                          : online
                                            ? 'Online'
                                            : vault.lastSeenAt === null
                                              ? 'Never connected'
                                              : 'Offline'}
                                </span>
                            </span>
                            {selected && (
                                <MdCheckCircle
                                    size={18}
                                    className="shrink-0"
                                    aria-hidden="true"
                                />
                            )}
                        </motion.button>
                    );
                })}
            </div>
            {view.selected &&
                !view.hasVaultKey &&
                !loading &&
                !pending &&
                !offline && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-3 text-fg-brand">
                        <MdKey size={18} aria-hidden="true" />
                        <p className="min-w-40 flex-1 text-xs leading-[1.6] text-fg-muted">
                            This browser needs this vault’s key.
                        </p>
                        <button
                            type="button"
                            className="inline-flex items-center justify-center gap-[7px] whitespace-nowrap font-semibold [&_svg]:shrink-0 disabled:cursor-not-allowed disabled:opacity-55 motion-safe:enabled:active:scale-[0.98] min-h-8 border-0 bg-transparent px-0.5 py-0 text-xs text-fg-brand underline underline-offset-3 cursor-pointer"
                            onClick={onReceiveKey}
                        >
                            Receive key
                        </button>
                    </div>
                )}
        </section>
    );
}
