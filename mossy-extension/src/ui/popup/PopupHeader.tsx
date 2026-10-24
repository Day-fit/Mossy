import { MdLogout, MdClose, MdSettings } from 'react-icons/md';
import AppHeader from '../shared/AppHeader';

type PopupHeaderProps = {
    signedIn: boolean;
    username?: string;
    loading: boolean;
    settings: boolean;
    onSignOut: () => void;
    onToggleSettings: () => void;
    onHome: () => void;
};

export default function PopupHeader({
    signedIn,
    username,
    loading,
    settings,
    onSignOut,
    onToggleSettings,
    onHome,
}: PopupHeaderProps) {
    return (
        <AppHeader onHome={onHome}>
            {username && (
                <span
                    className="account-label"
                    title={`Signed in as ${username}`}
                >
                    {username}
                </span>
            )}
            {signedIn && (
                <button
                    className="icon"
                    aria-label="Sign out"
                    title="Sign out"
                    disabled={loading}
                    onClick={onSignOut}
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
                onClick={onToggleSettings}
            >
                {settings ? <MdClose /> : <MdSettings />}
            </button>
        </AppHeader>
    );
}
