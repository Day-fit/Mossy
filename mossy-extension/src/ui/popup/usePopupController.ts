import { useCallback, useEffect, useRef, useState } from 'react';
import { messaging } from '../../messaging/rpc';
import { matchesSite, type Target } from '../../security/security';
import type { Entry, Operation } from '../../types/models';
import type { PopupView } from './types';
import { usePopupStore } from './usePopupStore';
import { useVaultStore } from '../shared/useVaultStore';

const actionMessages = {
    'copy-password': 'handleCopyPassword',
    fill: 'handleFill',
    save: 'handleSave',
    'sync-send': 'handleSyncSend',
    'sync-receive': 'handleSyncReceive',
} as const;

export function usePopupController() {
    const { view, error, loading, set } = usePopupStore();
    const [settings, setSettings] = useState(false);
    const [enrollmentPending, setEnrollmentPending] = useState(false);
    const [search, setSearch] = useState('');
    const [working, setWorking] = useState(false);
    const [notice, setNotice] = useState('');
    const [sync, setSync] = useState(false);
    const [updateId, setUpdateId] = useState('');

    const selected = useRef<string | undefined>(undefined);
    const previousPanel = useRef('');
    const load = useCallback(
        async (vaultId?: string, quiet = false) => {
            if (!quiet) set({ loading: true, error: undefined });

            try {
                const next: PopupView = await messaging.sendMessage(
                    'getPopupView',
                    {
                        vaultId: vaultId ?? selected.current,
                    }
                );

                selected.current = next.selected;
                if (next.account) {
                    useVaultStore.getState().setVaults(
                        {
                            instance: next.instance,
                            accountId: next.account.userId,
                        },
                        next.vaults
                    );
                }
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

        const unsubscribe = messaging.onMessage('onChanged', () => {
            void load(undefined, true);
        });

        return () => {
            unsubscribe();
        };
    }, [load]);

    useEffect(() => {
        if (!notice) return;
        const timer = setTimeout(() => setNotice(''), 2500);
        return () => clearTimeout(timer);
    }, [notice]);

    useEffect(() => {
        const panel = settings ? 'settings' : sync ? 'sync' : '';
        if (settings) {
            document.getElementById('settings-title')?.focus();
        } else if (sync) {
            document.getElementById('sync-heading')?.focus();
        } else if (previousPanel.current) {
            document
                .querySelector<HTMLElement>(
                    previousPanel.current === 'settings'
                        ? '[aria-label="Settings"]'
                        : '[aria-label="Sync vault keys"]'
                )
                ?.focus();
        }
        previousPanel.current = panel;
    }, [settings, sync]);

    const run = async (work: () => Promise<unknown>) => {
        setWorking(true);
        set({ error: undefined });

        try {
            await work();
            await load(view?.selected);
        } catch (error) {
            set({
                error:
                    error instanceof Error ? error.message : 'Request failed.',
                loading: false,
            });
        } finally {
            setWorking(false);
        }
    };

    const action = async (
        operation: Operation,
        entry?: Entry,
        target?: Target,
        code?: string
    ) => {
        if (operation === 'copy-username') {
            try {
                if (!entry) {
                    throw new Error('Choose a password.');
                }

                await navigator.clipboard.writeText(entry.identifier);
                setNotice('Username copied to clipboard.');
            } catch (error) {
                set({
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Could not copy username.',
                });
            }
            return;
        }

        return run(async () => {
            if (!view?.selected) {
                throw new Error('Choose a vault.');
            }

            await messaging.sendMessage(actionMessages[operation], {
                vaultId: view.selected,
                passwordId: entry?.passwordId,
                target,
                code,
            });
            window.close();
        });
    };

    const pending =
        view?.pending &&
        view.pending.deadline > Date.now() &&
        !view.pending.handedOff
            ? view.pending
            : undefined;
    const matches = pending
        ? (view?.entries ?? []).filter(
              (entry) =>
                  matchesSite(entry.address, pending.origin) &&
                  entry.identifier === pending.identifier
          )
        : [];
    const searchTerm = search.trim().toLowerCase();
    const filteredEntries =
        view?.entries.filter((entry) =>
            `${entry.address} ${entry.identifier}`
                .toLowerCase()
                .includes(searchTerm)
        ) ?? [];

    const signIn = (credentials: { identifier: string; password: string }) =>
        run(async () => {
            setEnrollmentPending(false);

            try {
                const response = await messaging.sendMessage(
                    'handleLogin',
                    credentials
                );
                setEnrollmentPending(response.status === 'enrollment-pending');
            } finally {
                credentials.password = '';
            }
        });
    const dismissError = () => set({ error: undefined });
    const reportError = (error: string) => set({ error });
    const selectVault = (vaultId: string) => {
        if (vaultId === view?.selected) return;
        selected.current = vaultId;
        setUpdateId('');
        setNotice('');
        if (view) set({ view: { ...view, selected: vaultId, entries: [] } });
        void load(vaultId);
    };
    const home = () => {
        setSettings(false);
        setSync(false);
        setSearch('');
        setNotice('');
    };

    return {
        view,
        error,
        loading: loading || working,
        notice,
        settings,
        setSettings,
        enrollmentPending,
        search,
        setSearch,
        sync,
        setSync,
        updateId,
        setUpdateId,
        load,
        run,
        action,
        pending,
        matches,
        filteredEntries,
        signIn,
        dismissError,
        reportError,
        selectVault,
        home,
    };
}
