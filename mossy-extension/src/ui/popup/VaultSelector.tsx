import { MdStorage } from 'react-icons/md';
import type { PopupView } from './types';

type VaultSelectorProps = {
    view: Pick<PopupView, 'vaults' | 'selected'>;
    pending: boolean;
    loading: boolean;
    onSelect: (vaultId: string) => void;
};

export default function VaultSelector({
    view,
    pending,
    loading,
    onSelect,
}: VaultSelectorProps) {
    return (
        <section className="panel vault-panel" aria-labelledby="vault-heading">
            <div className="section-heading">
                <h2 id="vault-heading">
                    <MdStorage size={20} aria-hidden="true" /> Vaults
                </h2>
                <span className="count">{view.vaults.length} total</span>
            </div>
            <label htmlFor="vault">
                Vault{pending ? ' · save destination' : ''}
            </label>
            <select
                id="vault"
                value={view.selected ?? ''}
                onChange={(event) => onSelect(event.target.value)}
                disabled={loading}
            >
                <option value="" disabled>
                    Select a vault
                </option>
                {view.vaults.map((vault) => (
                    <option key={vault.vaultId} value={vault.vaultId}>
                        {vault.vaultName}
                    </option>
                ))}
            </select>
        </section>
    );
}
