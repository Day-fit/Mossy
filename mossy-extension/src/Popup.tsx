import { Button } from '@mossy/ui';
import { MdErrorOutline, MdClose } from 'react-icons/md';
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

export default function Popup() {
    const theme = useTheme();
    const popup = usePopupController();
    const { view, error, loading, settings, setSettings, run, action } = popup;

    return (
        <main className="popup">
            <PopupHeader
                signedIn={!!view?.account}
                loading={loading}
                settings={settings}
                onSignOut={() =>
                    void run(() => messaging.sendMessage('handleLogout'))
                }
                onToggleSettings={() => setSettings(!settings)}
            />
            <div className="page-content">
                {error && (!view || settings || view.account) && (
                    <div role="alert" className="status error">
                        <MdErrorOutline size={18} aria-hidden="true" />
                        <span>{error}</span>
                        {view && (
                            <button
                                className="icon"
                                aria-label="Dismiss error"
                                onClick={popup.dismissError}
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
                        run={run}
                        onSaved={() => setSettings(false)}
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
                            {popup.pending && (
                                <PendingPassword
                                    pending={popup.pending}
                                    matches={popup.matches}
                                    now={popup.now}
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
                                />
                            )}
                            <VaultSelector
                                view={view}
                                pending={!!popup.pending}
                                loading={loading}
                                onSelect={popup.selectVault}
                            />
                            <PasswordList
                                view={view}
                                loading={loading}
                                filteredEntries={popup.filteredEntries}
                                search={popup.search}
                                setSearch={popup.setSearch}
                                sync={popup.sync}
                                onToggleSync={() => popup.setSync(!popup.sync)}
                                onOpenSettings={() => setSettings(true)}
                                action={action}
                            />
                            {popup.sync && (
                                <VaultKeySync
                                    loading={loading}
                                    selected={view.selected}
                                    action={action}
                                />
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
