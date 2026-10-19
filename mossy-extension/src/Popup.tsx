import { useCallback, useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { Button } from '@mossy/ui';
import {
    MdSettings,
    MdLogout,
    MdSearch,
    MdStorage,
    MdPassword,
    MdInfoOutline,
    MdErrorOutline,
    MdExpandMore,
    MdWarningAmber,
    MdClose,
    MdKey,
} from 'react-icons/md';
import {
    AppHeader,
    EmptyState,
    LoadingState,
    SecurityNotice,
} from './components';
import { rpc } from './rpc';
import SignIn from './SignIn';
import { matchesSite, normalizeInstance, type Target } from './security';
import type { Entry, Vault, Operation } from './models';
import type { PendingMetadata } from './pending';
type View = {
    instance: string;
    theme: 'light' | 'dark' | 'system';
    permission: boolean;
    account: { userId: string; username: string } | null;
    selected?: string;
    vaults: Vault[];
    entries: Entry[];
    pending: PendingMetadata | null;
    targets: Target[];
};
// Metadata only. Secrets live in transient input elements and action workers.
const usePopup = create<{
    view?: View;
    error?: string;
    loading: boolean;
    set: (
        value: Partial<{
            view: View;
            error: string | undefined;
            loading: boolean;
        }>
    ) => void;
}>((set) => ({ loading: true, set }));
export default function Popup() {
    const { view, error, loading, set } = usePopup();
    const [settings, setSettings] = useState(false);
    const [enrollmentPending, setEnrollmentPending] = useState(false);
    const [search, setSearch] = useState('');
    const [now, setNow] = useState(Date.now());
    const [sync, setSync] = useState(false);
    const [updateId, setUpdateId] = useState('');
    const selected = useRef<string | undefined>(undefined);
    const requestVersion = useRef(0);
    const load = useCallback(
        async (vaultId?: string) => {
            const request = ++requestVersion.current;
            set({ loading: true, error: undefined });
            try {
                const next = await rpc<View>({
                    kind: 'state',
                    vaultId: vaultId ?? selected.current,
                });
                if (request !== requestVersion.current) return;
                selected.current = next.selected;
                set({ view: next, loading: false });
            } catch (error) {
                if (request !== requestVersion.current) return;
                set({
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Could not load Mossy.',
                    loading: false,
                });
            }
        },
        [set]
    );
    useEffect(() => {
        void load();
        const listener = (message: { kind: string }) => {
            if (message.kind === 'changed') void load();
        };
        chrome.runtime.onMessage.addListener(listener);
        const port = chrome.runtime.connect({ name: 'popup' });
        const timer = setInterval(() => setNow(Date.now()), 200);
        return () => {
            clearInterval(timer);
            chrome.runtime.onMessage.removeListener(listener);
            port.disconnect();
        };
    }, [load]);
    useEffect(() => {
        if (view) document.documentElement.dataset.theme = view.theme;
    }, [view]);
    useEffect(() => {
        if (settings) document.getElementById('settings-title')?.focus();
        else if (sync) document.getElementById('sync-heading')?.focus();
    }, [settings, sync]);
    const run = async (work: () => Promise<unknown>) => {
        set({ loading: true, error: undefined });
        try {
            await work();
            await load(view?.selected);
        } catch (error) {
            set({
                error:
                    error instanceof Error ? error.message : 'Request failed.',
                loading: false,
            });
        }
    };
    const action = (
        operation: Operation,
        entry?: Entry,
        target?: Target,
        code?: string,
        protection?: 'PRF' | 'Password'
    ) =>
        run(async () => {
            if (operation === 'copy-username') {
                await navigator.clipboard.writeText(entry!.identifier);
                return;
            }
            await rpc({
                kind: 'action',
                operation,
                vaultId: view!.selected,
                passwordId: entry?.passwordId,
                target,
                code,
                protection,
            });
            window.close();
        });
    const pending =
        view?.pending && view.pending.deadline > now && !view.pending.handedOff
            ? view.pending
            : undefined;
    const matches = pending
        ? view!.entries.filter(
              (entry) =>
                  matchesSite(entry.address, pending.origin) &&
                  entry.identifier === pending.identifier
          )
        : [];
    const filteredEntries =
        view?.entries.filter((entry) =>
            `${entry.address} ${entry.identifier}`
                .toLowerCase()
                .includes(search.trim().toLowerCase())
        ) ?? [];
    return (
        <main className="popup">
            <AppHeader>
                {view?.account && (
                    <button
                        className="icon"
                        aria-label="Sign out"
                        title="Sign out"
                        disabled={loading}
                        onClick={() => void run(() => rpc({ kind: 'logout' }))}
                    >
                        <MdLogout />
                    </button>
                )}
                <button
                    className="icon"
                    aria-label={settings ? 'Close settings' : 'Settings'}
                    title={settings ? 'Close settings' : 'Settings'}
                    aria-expanded={settings}
                    aria-controls={settings ? 'extension-settings' : undefined}
                    onClick={() => setSettings(!settings)}
                >
                    {settings ? <MdClose /> : <MdSettings />}
                </button>
            </AppHeader>
            <div className="page-content">
                {error && (!view || settings || view.account) && (
                    <div role="alert" className="status error">
                        <MdErrorOutline size={18} aria-hidden="true" />
                        <span>{error}</span>
                        {view && (
                            <button
                                className="icon"
                                aria-label="Dismiss error"
                                onClick={() => set({ error: undefined })}
                            >
                                <MdClose />
                            </button>
                        )}
                    </div>
                )}
                {!view && loading && (
                    <div className="panel">
                        <LoadingState>Loading Mossy…</LoadingState>
                    </div>
                )}
                {!view && !loading && error && (
                    <Button
                        padding="medium"
                        variant="outline"
                        onClick={() => void load()}
                    >
                        Try again
                    </Button>
                )}
                {view && settings ? (
                    <form
                        id="extension-settings"
                        className="panel settings-panel"
                        aria-busy={loading}
                        onSubmit={(event) => {
                            event.preventDefault();
                            const data = new FormData(event.currentTarget);
                            void run(async () => {
                                const instance = normalizeInstance(
                                    String(data.get('instance')),
                                    import.meta.env.DEV
                                );
                                if (
                                    !(await chrome.permissions.request({
                                        origins: [`${instance}/*`],
                                    }))
                                )
                                    throw new Error(
                                        'Instance host access was declined.'
                                    );
                                await rpc({
                                    kind: 'settings',
                                    instance,
                                    theme: data.get('theme'),
                                });
                                setSettings(false);
                            });
                        }}
                    >
                        <div className="intro">
                            <h2 id="settings-title" tabIndex={-1}>
                                Settings
                            </h2>
                            <p>
                                Choose how Mossy looks and works in your
                                browser.
                            </p>
                        </div>
                        <label htmlFor="theme">Appearance</label>
                        <select
                            id="theme"
                            name="theme"
                            defaultValue={view.theme}
                            disabled={loading}
                        >
                            <option value="system">System</option>
                            <option value="light">Light</option>
                            <option value="dark">Dark</option>
                        </select>
                        <p className="muted">
                            Follow your device or choose a light or dark theme.
                        </p>
                        <div className="settings-divider">
                            <h3>Website access</h3>
                            <p className="muted">
                                Allow HTTPS website access to fill forms and
                                offer to save submitted passwords.
                            </p>
                            <Button
                                type="button"
                                padding="medium"
                                variant="outline"
                                disabled={loading || view.permission}
                                onClick={() =>
                                    void run(async () => {
                                        if (
                                            !(await chrome.permissions.request({
                                                origins: ['https://*/*'],
                                            }))
                                        )
                                            throw new Error(
                                                'Website access was declined. Metadata and copy are still available.'
                                            );
                                    })
                                }
                            >
                                {view.permission
                                    ? 'Website access enabled'
                                    : 'Enable fill and capture'}
                            </Button>
                        </div>
                        <details className="advanced-settings">
                            <summary>
                                Advanced settings
                                <MdExpandMore size={20} aria-hidden="true" />
                            </summary>
                            <div
                                className="advanced-warning"
                                id="instance-warning"
                            >
                                <MdWarningAmber size={20} aria-hidden="true" />
                                <div>
                                    <h3>
                                        Only change this if you know what you’re
                                        doing
                                    </h3>
                                    <p>
                                        Your sign-in credentials will be sent to
                                        this server. Only use a Mossy instance
                                        you trust. Changing it signs you out.
                                    </p>
                                </div>
                            </div>
                            <label htmlFor="instance">Mossy instance</label>
                            <input
                                id="instance"
                                name="instance"
                                type="url"
                                required
                                defaultValue={view.instance}
                                disabled={loading}
                                aria-describedby="instance-warning"
                                onInvalid={(event) => {
                                    event.currentTarget.closest(
                                        'details'
                                    )!.open = true;
                                }}
                            />
                        </details>
                        <Button
                            type="submit"
                            padding="medium"
                            disabled={loading}
                            className="settings-save"
                        >
                            Save settings
                        </Button>
                    </form>
                ) : view && !view.account ? (
                    <SignIn
                        instance={view.instance}
                        loading={loading}
                        error={error}
                        enrollmentPending={enrollmentPending}
                        onDismissError={() => set({ error: undefined })}
                        onSignIn={(credentials) =>
                            run(async () => {
                                setEnrollmentPending(false);
                                try {
                                    const response = await rpc<{
                                        status: string;
                                    }>({
                                        kind: 'login',
                                        ...credentials,
                                    });
                                    setEnrollmentPending(
                                        response.status === 'enrollment-pending'
                                    );
                                } finally {
                                    credentials.password = '';
                                }
                            })
                        }
                    />
                ) : (
                    view && (
                        <>
                            {pending && (
                                <section
                                    className="panel pending"
                                    aria-label="Save captured password"
                                >
                                    <div className="section-heading">
                                        <h2>
                                            {matches.length
                                                ? 'Update password?'
                                                : 'Save password?'}
                                        </h2>
                                        <button
                                            className="icon"
                                            aria-label="Decline save"
                                            onClick={() =>
                                                void run(() =>
                                                    rpc({ kind: 'dismiss' })
                                                )
                                            }
                                        >
                                            <MdClose />
                                        </button>
                                    </div>
                                    <div className="capture-details">
                                        <p>{pending.origin}</p>
                                        <p>{pending.identifier}</p>
                                        <p
                                            className="capture-mask"
                                            aria-label="Masked captured password"
                                        >
                                            ••••••••••••
                                        </p>
                                    </div>
                                    <p role="timer">
                                        Expires in{' '}
                                        {Math.max(
                                            0,
                                            Math.ceil(
                                                (pending.deadline - now) / 1000
                                            )
                                        )}{' '}
                                        seconds
                                    </p>
                                    {matches.length > 1 && (
                                        <>
                                            <label htmlFor="update-record">
                                                Entry to update
                                            </label>
                                            <select
                                                id="update-record"
                                                value={updateId}
                                                onChange={(event) =>
                                                    setUpdateId(
                                                        event.target.value
                                                    )
                                                }
                                            >
                                                <option value="">
                                                    Choose an entry
                                                </option>
                                                {matches.map((entry) => (
                                                    <option
                                                        key={entry.passwordId}
                                                        value={entry.passwordId}
                                                    >
                                                        {entry.identifier} ·{' '}
                                                        {entry.address} ·{' '}
                                                        {entry.lastModified}
                                                    </option>
                                                ))}
                                            </select>
                                        </>
                                    )}
                                    <Button
                                        padding="medium"
                                        disabled={
                                            loading ||
                                            !view.selected ||
                                            (matches.length > 1 &&
                                                !matches.some(
                                                    (entry) =>
                                                        entry.passwordId ===
                                                        updateId
                                                ))
                                        }
                                        onClick={() =>
                                            void action(
                                                'save',
                                                matches.length === 1
                                                    ? matches[0]
                                                    : matches.find(
                                                          (entry) =>
                                                              entry.passwordId ===
                                                              updateId
                                                      )
                                            )
                                        }
                                    >
                                        {matches.length
                                            ? 'Authorize update'
                                            : 'Authorize save'}
                                    </Button>
                                </section>
                            )}
                            <section
                                className="panel vault-panel"
                                aria-labelledby="vault-heading"
                            >
                                <div className="section-heading">
                                    <h2 id="vault-heading">
                                        <MdStorage
                                            size={20}
                                            aria-hidden="true"
                                        />{' '}
                                        Vaults
                                    </h2>
                                    <span className="count">
                                        {view.vaults.length} total
                                    </span>
                                </div>
                                <label htmlFor="vault">
                                    Vault{pending ? ' · save destination' : ''}
                                </label>
                                <select
                                    id="vault"
                                    value={view.selected ?? ''}
                                    onChange={(event) => {
                                        setUpdateId('');
                                        void load(event.target.value);
                                    }}
                                    disabled={loading}
                                >
                                    <option value="" disabled>
                                        Select a vault
                                    </option>
                                    {view.vaults.map((vault) => (
                                        <option
                                            key={vault.vaultId}
                                            value={vault.vaultId}
                                        >
                                            {vault.vaultName}
                                        </option>
                                    ))}
                                </select>
                            </section>
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
                                        aria-controls={
                                            sync ? 'vault-key-sync' : undefined
                                        }
                                        onClick={() => setSync(!sync)}
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
                                        onChange={(event) =>
                                            setSearch(event.target.value)
                                        }
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
                                            Save a login on a website or add one
                                            in the Mossy web app.
                                        </EmptyState>
                                    ) : !filteredEntries.length ? (
                                        <EmptyState title="No matching passwords">
                                            Try a different site or username.
                                        </EmptyState>
                                    ) : (
                                        filteredEntries.map((entry) => {
                                            const target = view.targets.find(
                                                (target) =>
                                                    matchesSite(
                                                        entry.address,
                                                        target.origin
                                                    )
                                            );
                                            return (
                                                <article
                                                    className="entry"
                                                    key={entry.passwordId}
                                                >
                                                    <div className="entry-heading">
                                                        <span
                                                            className="entry-symbol"
                                                            aria-hidden="true"
                                                        >
                                                            <MdPassword
                                                                size={18}
                                                            />
                                                        </span>
                                                        <div className="entry-details">
                                                            <strong>
                                                                {
                                                                    entry.identifier
                                                                }
                                                            </strong>
                                                            <span className="muted site">
                                                                {entry.address}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="row">
                                                        <Button
                                                            padding="small"
                                                            variant="outline"
                                                            disabled={loading}
                                                            onClick={() =>
                                                                void action(
                                                                    'copy-username',
                                                                    entry
                                                                )
                                                            }
                                                        >
                                                            Username
                                                        </Button>
                                                        <Button
                                                            padding="small"
                                                            variant="outline"
                                                            disabled={loading}
                                                            onClick={() =>
                                                                void action(
                                                                    'copy-password',
                                                                    entry
                                                                )
                                                            }
                                                        >
                                                            Password
                                                        </Button>
                                                        <Button
                                                            padding="small"
                                                            title={
                                                                !view.permission
                                                                    ? 'Enable website access in Settings to fill'
                                                                    : !target
                                                                      ? 'Open a matching login form to fill'
                                                                      : 'Fill this login form'
                                                            }
                                                            disabled={
                                                                loading ||
                                                                !view.permission ||
                                                                !target
                                                            }
                                                            onClick={() =>
                                                                void action(
                                                                    'fill',
                                                                    entry,
                                                                    target
                                                                )
                                                            }
                                                        >
                                                            Fill
                                                        </Button>
                                                    </div>
                                                </article>
                                            );
                                        })
                                    )}
                                </div>
                                {!view.permission && (
                                    <p className="access-hint">
                                        <MdInfoOutline
                                            size={16}
                                            aria-hidden="true"
                                        />
                                        <span>
                                            Fill and capture are disabled.{' '}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setSettings(true)
                                                }
                                            >
                                                Enable in Settings
                                            </button>
                                            .
                                        </span>
                                    </p>
                                )}
                            </section>
                            {sync && (
                                <section
                                    id="vault-key-sync"
                                    className="panel sync-panel"
                                    aria-labelledby="sync-heading"
                                >
                                    <div className="intro">
                                        <h2 id="sync-heading" tabIndex={-1}>
                                            Sync a vault key
                                        </h2>
                                        <p className="muted">
                                            Receive from an approved device or
                                            enter its receiving code to send
                                            this vault key.
                                        </p>
                                    </div>
                                    <div className="row">
                                        <Button
                                            padding="small"
                                            variant="outline"
                                            disabled={loading || !view.selected}
                                            onClick={() =>
                                                void action(
                                                    'sync-receive',
                                                    undefined,
                                                    undefined,
                                                    undefined,
                                                    'PRF'
                                                )
                                            }
                                        >
                                            Receive · passkey
                                        </Button>
                                        <Button
                                            padding="small"
                                            variant="outline"
                                            disabled={loading || !view.selected}
                                            onClick={() =>
                                                void action(
                                                    'sync-receive',
                                                    undefined,
                                                    undefined,
                                                    undefined,
                                                    'Password'
                                                )
                                            }
                                        >
                                            Receive · password
                                        </Button>
                                    </div>
                                    <form
                                        onSubmit={(event) => {
                                            event.preventDefault();
                                            const code = String(
                                                new FormData(
                                                    event.currentTarget
                                                ).get('code')
                                            ).toUpperCase();
                                            void action(
                                                'sync-send',
                                                undefined,
                                                undefined,
                                                code
                                            );
                                        }}
                                    >
                                        <label htmlFor="code">
                                            Receiving code
                                        </label>
                                        <input
                                            id="code"
                                            name="code"
                                            minLength={6}
                                            maxLength={6}
                                            pattern="[A-Za-z0-9]{6}"
                                            required
                                            autoComplete="off"
                                        />
                                        <Button
                                            type="submit"
                                            padding="small"
                                            disabled={loading || !view.selected}
                                        >
                                            Authorize send
                                        </Button>
                                    </form>
                                </section>
                            )}

                            <SecurityNotice>
                                Authorize each password copy, fill, save, or key
                                transfer.
                            </SecurityNotice>
                        </>
                    )
                )}
            </div>
        </main>
    );
}
