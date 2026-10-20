import { MdKey, MdSearch, MdInfoOutline } from 'react-icons/md';
import EmptyState from '../shared/EmptyState';
import PasswordEntry from './PasswordEntry';
import { matchesSite } from '../../security/security';
import type { Entry } from '../../types/models';
import type { PopupView, RunPopupAction } from './types';

type PasswordListProps = {
    view: Pick<
        PopupView,
        'vaults' | 'entries' | 'targets' | 'instance' | 'permission'
    >;
    loading: boolean;
    filteredEntries: Entry[];
    search: string;
    setSearch: (search: string) => void;
    sync: boolean;
    onToggleSync: () => void;
    onOpenSettings: () => void;
    action: RunPopupAction;
};

export default function PasswordList({
    view,
    loading,
    filteredEntries,
    search,
    setSearch,
    sync,
    onToggleSync,
    onOpenSettings,
    action,
}: PasswordListProps) {
    return (
        <section
            className="panel password-panel"
            aria-labelledby="passwords-heading"
        >
            <div className="section-heading">
                <h2 id="passwords-heading">Passwords</h2>
                <button
                    className="icon"
                    aria-label="Sync vault keys"
                    title="Sync vault keys"
                    aria-expanded={sync}
                    aria-controls={sync ? 'vault-key-sync' : undefined}
                    onClick={onToggleSync}
                >
                    <MdKey />
                </button>
            </div>
            <label htmlFor="search" className="sr-only">
                Search passwords
            </label>
            <div className="search-field">
                <input
                    id="search"
                    className="search"
                    type="search"
                    placeholder="Search site or username"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                />
                <MdSearch size={18} aria-hidden="true" />
            </div>
            <div className="scroll" aria-busy={loading}>
                {!view.vaults.length ? (
                    <EmptyState title="Your first vault starts here">
                        <a
                            href={view.instance + '/vaults'}
                            target="_blank"
                            rel="noreferrer"
                        >
                            Create a vault in Mossy
                        </a>{' '}
                        to get started.
                    </EmptyState>
                ) : !view.entries.length ? (
                    <EmptyState title="No passwords yet">
                        Save a login on a website or add one in the Mossy web
                        app.
                    </EmptyState>
                ) : !filteredEntries.length ? (
                    <EmptyState title="No matching passwords">
                        Try a different site or username.
                    </EmptyState>
                ) : (
                    filteredEntries.map((entry) => {
                        const target = view.targets.find((target) =>
                            matchesSite(entry.address, target.origin)
                        );

                        return (
                            <PasswordEntry
                                key={entry.passwordId}
                                entry={entry}
                                target={target}
                                permission={view.permission}
                                loading={loading}
                                action={action}
                            />
                        );
                    })
                )}
            </div>
            {!view.permission && (
                <p className="access-hint">
                    <MdInfoOutline size={16} aria-hidden="true" />
                    <span>
                        Fill and capture are disabled.{' '}
                        <button type="button" onClick={() => onOpenSettings()}>
                            Enable in Settings
                        </button>
                        .
                    </span>
                </p>
            )}
        </section>
    );
}
