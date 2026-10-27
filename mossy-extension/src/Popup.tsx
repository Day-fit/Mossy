import { Button } from '@mossy/ui';
import LoadingState from './ui/shared/LoadingState';
import SecurityNotice from './ui/shared/SecurityNotice';
import PopupHeader from './ui/popup/PopupHeader';
import PopupSettings from './ui/popup/PopupSettings';
import PendingPassword from './ui/popup/PendingPassword';
import VaultSelector from './ui/popup/VaultSelector';
import PasswordList from './ui/popup/PasswordList';
import VaultKeySync from './ui/popup/VaultKeySync';
import { usePopupController } from './ui/popup/usePopupController';
import { messaging } from './messaging/rpc';
import SignIn from './ui/auth/SignIn';
import { useTheme } from './theme/useTheme';
import ViewTransition from './ui/shared/ViewTransition';
import Feedback from './ui/shared/Feedback';
import OfflineVault from './ui/popup/OfflineVault';

export default function Popup() {
    const { theme, apply } = useTheme();
    const popup = usePopupController();
    const { view, error, loading, settings, setSettings, run, action } = popup;
    const selectedVault = view?.vaults.find(
        (vault) => vault.vaultId === view.selected
    );
    const vaultOffline =
        !!view?.vaultUnavailable ||
        (selectedVault?.isOnline ?? selectedVault?.online) === false;

    return (
        <main className="popup flex max-h-[600px] min-h-[480px] w-[520px] max-w-full flex-col overflow-hidden text-sm leading-normal">
            <PopupHeader
                signedIn={!!view?.account}
                username={view?.account?.username}
                loading={loading}
                settings={settings}
                onSignOut={() =>
                    void run(() => messaging.sendMessage('handleLogout'))
                }
                onToggleSettings={() => setSettings(!settings)}
                onHome={popup.home}
            />
            <ViewTransition
                viewKey={
                    settings
                        ? 'settings'
                        : view?.account
                          ? popup.sync
                              ? 'sync'
                              : 'passwords'
                          : view
                            ? 'sign-in'
                            : 'loading'
                }
                className="page-content flex flex-col gap-3.5 [&>*]:shrink-0 min-h-0 overflow-y-auto overscroll-contain p-4 max-[400px]:p-3 [scrollbar-width:thin] [scrollbar-color:var(--color-border-strong)_transparent]"
            >
                {error && (!view || settings || view.account) && (
                    <Feedback onDismiss={view ? popup.dismissError : undefined}>
                        {error}
                        {view?.account && !settings && (
                            <button
                                type="button"
                                className="flex items-center justify-center gap-[7px] whitespace-nowrap font-semibold [&_svg]:shrink-0 disabled:cursor-not-allowed disabled:opacity-55 motion-safe:enabled:active:scale-[0.98] min-h-8 border-0 bg-transparent px-0.5 py-0 text-xs text-fg-brand underline underline-offset-3 mt-1 cursor-pointer"
                                onClick={() => void popup.load()}
                            >
                                Refresh passwords
                            </button>
                        )}
                    </Feedback>
                )}
                {!view && loading && (
                    <div className="min-w-0 rounded-xl border border-border bg-surface shadow-control p-5 max-[400px]:p-4">
                        <LoadingState>Loading Mossy…</LoadingState>
                    </div>
                )}
                {!view && !loading && error && (
                    <Button
                        className="inline-flex items-center justify-center gap-[7px] whitespace-nowrap font-semibold [&_svg]:shrink-0 disabled:cursor-not-allowed disabled:opacity-55 motion-safe:enabled:active:scale-[0.98] min-h-10 text-[0.8125rem] cursor-pointer"
                        padding="medium"
                        variant="outline"
                        onClick={() => void popup.load()}
                    >
                        Try again
                    </Button>
                )}
                {view && settings ? (
                    <PopupSettings
                        view={view}
                        loading={loading}
                        theme={theme}
                        onThemeChange={apply}
                        run={run}
                        onSaved={popup.home}
                        onError={popup.reportError}
                    />
                ) : view && !view.account ? (
                    <SignIn
                        instance={view.instance}
                        loading={loading}
                        error={error}
                        enrollmentPending={popup.enrollmentPending}
                        onDismissError={popup.dismissError}
                        onSignIn={popup.signIn}
                    />
                ) : (
                    view && (
                        <>
                            {popup.pending && !popup.sync && (
                                <PendingPassword
                                    pending={popup.pending}
                                    matches={popup.matches}
                                    loading={loading}
                                    selected={view.selected}
                                    updateId={popup.updateId}
                                    setUpdateId={popup.setUpdateId}
                                    action={action}
                                    onDismiss={() =>
                                        void run(() =>
                                            messaging.sendMessage(
                                                'handleDismiss'
                                            )
                                        )
                                    }
                                    hasVaultKey={view.hasVaultKey}
                                    onReceiveKey={() =>
                                        void action('sync-receive')
                                    }
                                    vaultOffline={vaultOffline}
                                />
                            )}
                            {!popup.sync && (
                                <>
                                    <VaultSelector
                                        view={view}
                                        pending={!!popup.pending}
                                        loading={loading}
                                        onSelect={popup.selectVault}
                                        onReceiveKey={() =>
                                            void action('sync-receive')
                                        }
                                    />
                                    {selectedVault && vaultOffline ? (
                                        <OfflineVault
                                            vault={selectedVault}
                                            unavailable={
                                                !!view.vaultUnavailable
                                            }
                                            loading={loading}
                                            onRefresh={() =>
                                                void popup.load(view.selected)
                                            }
                                        />
                                    ) : (
                                        <PasswordList
                                            view={view}
                                            loading={loading}
                                            filteredEntries={
                                                popup.filteredEntries
                                            }
                                            search={popup.search}
                                            setSearch={popup.setSearch}
                                            sync={popup.sync}
                                            onToggleSync={() =>
                                                popup.setSync(!popup.sync)
                                            }
                                            onOpenSettings={() =>
                                                setSettings(true)
                                            }
                                            action={action}
                                            notice={popup.notice}
                                        />
                                    )}
                                </>
                            )}
                            {popup.sync && (
                                <VaultKeySync
                                    loading={loading}
                                    selected={view.selected}
                                    vaultName={
                                        view.vaults.find(
                                            (vault) =>
                                                vault.vaultId === view.selected
                                        )?.vaultName
                                    }
                                    action={action}
                                    onClose={() => popup.setSync(false)}
                                />
                            )}
                        </>
                    )
                )}
            </ViewTransition>
        </main>
    );
}
