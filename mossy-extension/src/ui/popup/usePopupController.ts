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
    const [now, setNow] = useState(() => Date.now());
    const [sync, setSync] = useState(false);
    const [updateId, setUpdateId] = useState('');

    const selected = useRef<string | undefined>(undefined);
    const requestVersion = useRef(0);
    const load = useCallback(
        async (vaultId?: string) => {
            const request = ++requestVersion.current;
            set({ loading: true, error: undefined });

            try {
                const next: PopupView = await messaging.sendMessage(
                    'getPopupView',
                    {
                        vaultId: vaultId ?? selected.current,
                    }
                );
                if (request !== requestVersion.current) {
                    return;
                }

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
                if (request !== requestVersion.current) {
                    return;
                }

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
            void load();
        });
        const timer = setInterval(() => setNow(Date.now()), 200);

        return () => {
            clearInterval(timer);
            unsubscribe();
        };
    }, [load]);

    useEffect(() => {
        if (settings) {
            document.getElementById('settings-title')?.focus();
        } else if (sync) {
            document.getElementById('sync-heading')?.focus();
        }
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
        code?: string
    ) =>
        run(async () => {
            if (operation === 'copy-username') {
                if (!entry) {
                    throw new Error('Choose a password.');
                }

                await navigator.clipboard.writeText(entry.identifier);

                return;
            }

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

    const pending =
        view?.pending && view.pending.deadline > now && !view.pending.handedOff
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
        setUpdateId('');
        void load(vaultId);
    };

    return {
        view,
        error,
        loading,
        settings,
        setSettings,
        enrollmentPending,
        search,
        setSearch,
        now,
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
    };
}
