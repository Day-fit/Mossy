import { Button } from '@mossy/ui';
import {
    MdCheckCircle,
    MdDarkMode,
    MdExpandMore,
    MdLightMode,
    MdMonitor,
    MdWarningAmber,
} from 'react-icons/md';
import { usePopupSettings } from './usePopupSettings';
import type { Theme } from '../../theme/types';
import type { PopupView, RunPopupTask } from './types';

type PopupSettingsProps = {
    view: Pick<PopupView, 'instance' | 'permission'>;
    loading: boolean;
    theme: Theme;
    onThemeChange: (theme: Theme) => void;
    run: RunPopupTask;
    onSaved: () => void;
    onError: (message: string) => void;
};

export default function PopupSettings({
    view,
    loading,
    theme,
    onThemeChange,
    run,
    onSaved,
    onError,
}: PopupSettingsProps) {
    const { savingTheme, saveSettings, saveTheme, enableWebsiteAccess } =
        usePopupSettings({ run, onSaved, onError, theme, onThemeChange });
    return (
        <form
            id="extension-settings"
            className="panel settings-panel"
            aria-busy={loading}
            onSubmit={(event) => {
                event.preventDefault();

                const data = new FormData(event.currentTarget);
                void saveSettings(data);
            }}
        >
            <div className="intro">
                <h2 id="settings-title" tabIndex={-1}>
                    Settings
                </h2>
                <p>Choose how Mossy looks and works in your browser.</p>
            </div>
            <fieldset
                className="appearance-choices"
                disabled={loading}
                aria-busy={savingTheme}
            >
                <legend>Appearance</legend>
                {(
                    [
                        ['system', 'System', MdMonitor],
                        ['light', 'Light', MdLightMode],
                        ['dark', 'Dark', MdDarkMode],
                    ] as const
                ).map(([value, label, Icon]) => (
                    <label key={value} className="appearance-choice">
                        <input
                            type="radio"
                            name="theme"
                            value={value}
                            checked={theme === value}
                            onChange={() => void saveTheme(value)}
                        />
                        <span>
                            <Icon size={19} aria-hidden="true" />
                            {label}
                        </span>
                    </label>
                ))}
            </fieldset>
            <p className="muted">
                Follow your device or choose a light or dark theme. Changes save
                automatically.
            </p>
            <div className="settings-divider">
                <div className="settings-section-heading">
                    <h3>Website access</h3>
                    {view.permission && (
                        <span className="enabled-label">
                            <MdCheckCircle size={15} aria-hidden="true" />
                            Enabled
                        </span>
                    )}
                </div>
                <p className="muted">
                    Allow HTTPS website access to fill forms and offer to save
                    submitted passwords.
                </p>
                <Button
                    type="button"
                    padding="medium"
                    variant="outline"
                    disabled={loading || view.permission}
                    onClick={() => void enableWebsiteAccess()}
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
                <div className="advanced-warning" id="instance-warning">
                    <MdWarningAmber size={20} aria-hidden="true" />
                    <div>
                        <h3>Only change this if you know what you’re doing</h3>
                        <p>
                            Your sign-in credentials will be sent to this
                            server. Only use a Mossy instance you trust.
                            Changing it signs you out.
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
                        const details = event.currentTarget.closest('details');

                        if (details) {
                            details.open = true;
                        }
                    }}
                />
            </details>
            <Button
                type="submit"
                padding="medium"
                disabled={loading || savingTheme}
                className="settings-save"
            >
                Save settings
            </Button>
        </form>
    );
}
