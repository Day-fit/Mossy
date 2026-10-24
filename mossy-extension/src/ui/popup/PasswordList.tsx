import {
    MdKey,
    MdSearch,
    MdInfoOutline,
    MdStorage,
    MdPassword,
} from 'react-icons/md';
import EmptyState from '../shared/EmptyState';
import PasswordEntry from './PasswordEntry';
import { matchesSite } from '../../security/security';
import type { Entry } from '../../types/models';
import type { PopupView, RunPopupAction } from './types';
import Feedback from '../shared/Feedback';
import LoadingState from '../shared/LoadingState';
import ViewTransition from '../shared/ViewTransition';

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
    notice: string;
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
    notice,
}: PasswordListProps) {
    return (
        <section
            className="panel password-panel"
            aria-labelledby="passwords-heading"
        >
            <div className="section-heading">
                <h2 id="passwords-heading">Passwords</h2>
                <button
                    className="sync-toggle"
                    aria-label="Sync vault keys"
                    title="Sync vault keys"
                    aria-expanded={sync}
                    aria-controls={sync ? 'vault-key-sync' : undefined}
                    onClick={onToggleSync}
                    disabled={loading || !view.vaults.length}
                >
                    <MdKey aria-hidden="true" />
                    <span>Sync keys</span>
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
            {notice && (
                <Feedback tone="success" className="copy-feedback">
                    {notice}
                </Feedback>
            )}
            {search.trim() && (
                <p className="search-summary" aria-live="polite">
                    {filteredEntries.length} of {view.entries.length} passwords
                </p>
            )}
            <div className="scroll" aria-busy={loading}>
                {loading ? (
                    <LoadingState>Loading passwords…</LoadingState>
                ) : !view.vaults.length ? (
                    <EmptyState
                        title="Your first vault starts here"
                        icon={MdStorage}
                    >
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
                    <EmptyState title="No passwords yet" icon={MdPassword}>
                        Save a login on a website or{' '}
                        <a
                            href={view.instance + '/passwords'}
                            target="_blank"
                            rel="noreferrer"
                        >
                            add one in Mossy
                        </a>
                        .
                    </EmptyState>
                ) : !filteredEntries.length ? (
                    <EmptyState title="No matching passwords" icon={MdSearch}>
                        Try a different site or username.
                        <button
                            type="button"
                            className="text-button clear-search"
                            onClick={() => setSearch('')}
                        >
                            Clear search
                        </button>
                    </EmptyState>
                ) : (
                    <ViewTransition
                        viewKey={`${view.entries[0]?.passwordId ?? 'empty'}:${search.trim() ? 'search' : 'all'}`}
                        className="password-entries"
                    >
                        {filteredEntries.map((entry) => {
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
                        })}
                    </ViewTransition>
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
