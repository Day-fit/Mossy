import { useCallback, useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { Button } from '@mossy/ui';
import {
    MdSettings,
    MdLogout,
    MdVerifiedUser,
    MdClose,
    MdKey,
} from 'react-icons/md';
import { rpc } from './rpc';
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
    const [search, setSearch] = useState('');
    const [now, setNow] = useState(Date.now());
    const [sync, setSync] = useState(false);
    const [updateId, setUpdateId] = useState('');
    const selected = useRef<string | undefined>(undefined);
    const requestVersion = useRef(0);
    const load = useCallback(
        async (vaultId?: string) => {
            const request = ++requestVersion.current;
            try {
                const next = await rpc<View>({
                    kind: 'state',
                    vaultId: vaultId ?? selected.current,
                });
                if (request !== requestVersion.current) return;
                selected.current = next.selected;
                set({ view: next, loading: false });
            } catch (error) {
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
    return (
        <main>
            <header>
                <h1>
                    <img src="/mossy_logo.png" width="30" height="30" alt="" />
                    Mossy
                </h1>
                <div className="row">
                    {view?.account && (
                        <button
                            className="icon"
                            aria-label="Sign out"
                            onClick={() =>
                                void run(() => rpc({ kind: 'logout' }))
                            }
                        >
                            <MdLogout />
                        </button>
                    )}
                    <button
                        className="icon"
                        aria-label={settings ? 'Close settings' : 'Settings'}
                        onClick={() => setSettings(!settings)}
                    >
                        {settings ? <MdClose /> : <MdSettings />}
                    </button>
                </div>
            </header>
            {error && (
                <div role="alert" className="status error">
                    {error}
                    <button
                        className="icon"
                        aria-label="Dismiss error"
                        onClick={() => set({ error: undefined })}
                    >
                        <MdClose />
                    </button>
                </div>
            )}
            {!view && loading && <p role="status">Loading Mossy…</p>}
            {view && settings ? (
                <form
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
                    <h2>Settings</h2>
                    <label htmlFor="instance">Mossy instance</label>
                    <input
                        id="instance"
                        name="instance"
                        type="url"
                        required
                        defaultValue={view.instance}
                    />
                    <label htmlFor="theme">Appearance</label>
                    <select id="theme" name="theme" defaultValue={view.theme}>
                        <option value="system">System</option>
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                    </select>
                    <p className="muted">
                        Changing instances signs out this extension.
                        Registration is available in the web app.
                    </p>
                    <Button type="submit" padding="medium" disabled={loading}>
                        Save settings
                    </Button>
                    <label>Website access</label>
                    <p className="muted">
                        Allow HTTPS website access to fill forms and offer to
                        save submitted passwords.
                    </p>
                    <Button
                        type="button"
                        padding="medium"
                        variant="outline"
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
                </form>
            ) : view && !view.account ? (
                <>
                    <h2>Your vault, close at hand.</h2>
                    <p>
                        Sign in to enroll this browser as a new device. Approve
                        it from an existing Mossy device.
                    </p>
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            const form = event.currentTarget;
                            const data = new FormData(form);
                            const credentials = {
                                identifier: String(data.get('identifier')),
                                password: String(data.get('password')),
                            };
                            (
                                form.elements.namedItem(
                                    'password'
                                ) as HTMLInputElement
                            ).value = '';
                            void run(async () => {
                                try {
                                    const response = await rpc<{
                                        status: string;
                                    }>({ kind: 'login', ...credentials });
                                    if (
                                        response.status === 'enrollment-pending'
                                    )
                                        throw new Error(
                                            'Device enrollment pending. Approve this browser in Mossy, then sign in again.'
                                        );
                                } finally {
                                    credentials.password = '';
                                }
                            });
                        }}
                    >
                        <label htmlFor="identifier">Email or username</label>
                        <input
                            id="identifier"
                            name="identifier"
                            autoComplete="username"
                            required
                        />
                        <label htmlFor="password">Account password</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            required
                        />
                        <div className="actions">
                            <Button
                                type="submit"
                                padding="medium"
                                disabled={loading}
                            >
                                {loading ? 'Signing in…' : 'Sign in'}
                            </Button>
                        </div>
                    </form>
                    <p className="muted">
                        <a
                            href={view.instance + '/register'}
                            target="_blank"
                            rel="noreferrer"
                        >
                            Create an account in Mossy
                        </a>
                    </p>
                    <p className="notice">
                        <MdVerifiedUser />
                        Every secret action requires its own vault
                        authorization.
                    </p>
                </>
            ) : (
                view && (
                    <>
                        {pending && (
                            <section
                                className="pending"
                                aria-label="Save captured password"
                            >
                                <div className="row">
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
                                <p>{pending.origin}</p>
                                <p>{pending.identifier}</p>
                                <p aria-label="Masked captured password">
                                    ••••••••••••
                                </p>
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
                                                setUpdateId(event.target.value)
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
                        <div className="row">
                            <h2>Passwords</h2>
                            <button
                                className="icon"
                                aria-label="Sync vault keys"
                                onClick={() => setSync(!sync)}
                            >
                                <MdKey />
                            </button>
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
                        {sync && (
                            <section className="pending">
                                <h2>Sync a vault key</h2>
                                <p className="muted">
                                    Receive from an approved device or enter its
                                    receiving code to send this vault key.
                                </p>
                                <div className="row">
                                    <Button
                                        padding="small"
                                        variant="outline"
                                        disabled={!view.selected}
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
                                        disabled={!view.selected}
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
                                    <label htmlFor="code">Receiving code</label>
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
                                        disabled={!view.selected}
                                    >
                                        Authorize send
                                    </Button>
                                </form>
                            </section>
                        )}
                        {!view.permission && (
                            <p className="muted">
                                Fill and capture are disabled. Enable website
                                access in Settings.
                            </p>
                        )}
                        <label htmlFor="search" className="sr-only">
                            Search passwords
                        </label>
                        <input
                            id="search"
                            className="search"
                            type="search"
                            placeholder="Search site or username"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                        <div className="scroll" aria-busy={loading}>
                            {!view.vaults.length ? (
                                <p className="empty">
                                    Create a vault in the Mossy web app to get
                                    started.
                                </p>
                            ) : !view.entries.length ? (
                                <p className="empty">
                                    No passwords in this vault.
                                </p>
                            ) : (
                                view.entries
                                    .filter((entry) =>
                                        `${entry.address} ${entry.identifier}`
                                            .toLowerCase()
                                            .includes(search.toLowerCase())
                                    )
                                    .map((entry) => {
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
                                                <strong>
                                                    {entry.identifier}
                                                </strong>
                                                <span className="muted site">
                                                    {entry.address}
                                                </span>
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
                        <p className="notice">
                            <MdVerifiedUser />
                            Protected. Authorize each password copy, fill, save,
                            or key transfer.
                        </p>
                    </>
                )
            )}
        </main>
    );
}
