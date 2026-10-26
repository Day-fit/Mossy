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
            className="min-w-0 rounded-xl border border-border bg-surface shadow-control p-5 max-[400px]:p-4"
            aria-labelledby="passwords-heading"
        >
            <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg leading-[1.4]" id="passwords-heading">
                    Passwords
                </h2>
                <button
                    className="inline-flex items-center justify-center gap-[7px] whitespace-nowrap font-semibold [&_svg]:shrink-0 disabled:cursor-not-allowed disabled:opacity-55 motion-safe:enabled:active:scale-[0.98] min-h-10 text-[0.8125rem] cursor-pointer rounded-md border border-border bg-surface px-2.5 py-1.5 text-fg-brand hover:border-border-strong hover:bg-surface-subtle aria-expanded:border-fg-brand aria-expanded:bg-surface-subtle motion-safe:transition-[transform,background-color,border-color,color]"
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
            <div className="search-field relative mb-3.5">
                <input
                    id="search"
                    className="block min-h-11 w-full min-w-0 rounded-md border border-border-strong bg-surface pr-3 py-2.5 text-sm leading-normal text-fg-primary placeholder:text-fg-subtle placeholder:opacity-100 focus-visible:border-fg-brand focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-fg-danger pl-[38px]"
                    type="search"
                    placeholder="Search site or username"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                />
                <MdSearch
                    className="pointer-events-none absolute top-[13px] left-3 text-fg-muted"
                    size={18}
                    aria-hidden="true"
                />
            </div>
            {notice && (
                <Feedback tone="success" className="mb-3">
                    {notice}
                </Feedback>
            )}
            {search.trim() && (
                <p
                    className="leading-[1.6] -mt-1 mb-3 text-xs text-fg-muted"
                    aria-live="polite"
                >
                    {filteredEntries.length} of {view.entries.length} passwords
                </p>
            )}
            <div
                className="scroll -m-[3px] max-h-[260px] overflow-y-auto p-[3px] [scrollbar-width:thin] [scrollbar-color:var(--color-border-strong)_transparent]"
                aria-busy={loading}
            >
                {loading ? (
                    <LoadingState>Loading passwords…</LoadingState>
                ) : !view.vaults.length ? (
                    <EmptyState
                        title="Your first vault starts here"
                        icon={MdStorage}
                    >
                        <a
                            className="text-fg-brand underline-offset-3 hover:text-fg-brand-hover hover:underline"
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
                            className="text-fg-brand underline-offset-3 hover:text-fg-brand-hover hover:underline"
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
                            className="block whitespace-nowrap font-semibold disabled:cursor-not-allowed disabled:opacity-55 motion-safe:enabled:active:scale-[0.98] min-h-8 border-0 bg-transparent px-0.5 py-0 text-xs text-fg-brand underline underline-offset-3 mx-auto mt-2 cursor-pointer"
                            onClick={() => setSearch('')}
                        >
                            Clear search
                        </button>
                    </EmptyState>
                ) : (
                    <ViewTransition
                        viewKey={`${view.entries[0]?.passwordId ?? 'empty'}:${search.trim() ? 'search' : 'all'}`}
                        className="flex flex-col gap-2.5"
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
                <p className="leading-[1.6] mt-3.5 flex items-start gap-2 border-t border-border pt-3 text-xs text-fg-muted">
                    <MdInfoOutline
                        className="mt-0.5 shrink-0"
                        size={16}
                        aria-hidden="true"
                    />
                    <span>
                        Fill and capture are disabled.{' '}
                        <button
                            className="inline-flex items-center justify-center gap-[7px] whitespace-nowrap font-semibold [&_svg]:shrink-0 disabled:cursor-not-allowed disabled:opacity-55 motion-safe:enabled:active:scale-[0.98] min-h-0 border-0 bg-transparent p-0 text-xs text-fg-brand underline underline-offset-3 cursor-pointer"
                            type="button"
                            onClick={() => onOpenSettings()}
                        >
                            Enable in Settings
                        </button>
                        .
                    </span>
                </p>
            )}
        </section>
    );
}
