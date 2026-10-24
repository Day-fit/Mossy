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
        <section className="panel vault-panel" aria-labelledby="vault-heading">
            <div className="section-heading">
                <h2 id="vault-heading">
                    <MdStorage size={20} aria-hidden="true" /> Vaults
                </h2>
                <span className="count">{view.vaults.length} total</span>
            </div>
            {pending && (
                <p className="vault-destination">
                    Choose where to save this login.
                </p>
            )}
            <div className="vault-choices" role="group" aria-label="Vault">
                {view.vaults.map((vault) => {
                    const selected = vault.vaultId === view.selected;
                    const online = vault.isOnline ?? vault.online;
                    return (
                        <motion.button
                            key={vault.vaultId}
                            type="button"
                            className={`vault-choice${selected ? ' is-selected' : ''}`}
                            aria-pressed={selected}
                            aria-label={vault.vaultName}
                            data-online={online === false ? 'false' : undefined}
                            disabled={loading}
                            onClick={() => onSelect(vault.vaultId)}
                            whileTap={reduce ? undefined : { scale: 0.98 }}
                        >
                            <MdStorage size={19} aria-hidden="true" />
                            <span className="vault-choice-copy">
                                <strong>{vault.vaultName}</strong>
                                <span>
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
                                    className="vault-selected"
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
                    <div className="key-needed">
                        <MdKey size={18} aria-hidden="true" />
                        <p>This browser needs this vault’s key.</p>
                        <button
                            type="button"
                            className="text-button"
                            onClick={onReceiveKey}
                        >
                            Receive key
                        </button>
                    </div>
                )}
        </section>
    );
}
