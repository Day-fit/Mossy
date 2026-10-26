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
                    className="account-label max-w-[120px] truncate text-xs text-fg-muted"
                    title={`Signed in as ${username}`}
                >
                    {username}
                </span>
            )}
            {signedIn && (
                <button
                    className="inline-flex items-center justify-center gap-[7px] whitespace-nowrap font-semibold [&_svg]:shrink-0 disabled:cursor-not-allowed disabled:opacity-55 motion-safe:enabled:active:scale-[0.98] size-[38px] flex-[0_0_38px] rounded-md border border-border bg-surface p-0 text-[19px] text-fg-secondary hover:border-border-strong hover:bg-surface-subtle hover:text-fg-brand aria-expanded:border-fg-brand aria-expanded:bg-surface-subtle aria-expanded:text-fg-brand motion-safe:transition-[transform,background-color,border-color,color] cursor-pointer"
                    aria-label="Sign out"
                    title="Sign out"
                    disabled={loading}
                    onClick={onSignOut}
                >
                    <MdLogout />
                </button>
            )}
            <button
                className="inline-flex items-center justify-center gap-[7px] whitespace-nowrap font-semibold [&_svg]:shrink-0 disabled:cursor-not-allowed disabled:opacity-55 motion-safe:enabled:active:scale-[0.98] size-[38px] flex-[0_0_38px] rounded-md border border-border bg-surface p-0 text-[19px] text-fg-secondary hover:border-border-strong hover:bg-surface-subtle hover:text-fg-brand aria-expanded:border-fg-brand aria-expanded:bg-surface-subtle aria-expanded:text-fg-brand motion-safe:transition-[transform,background-color,border-color,color] cursor-pointer"
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
