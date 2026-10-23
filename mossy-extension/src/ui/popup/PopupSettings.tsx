import { Button } from '@mossy/ui';
import { MdExpandMore, MdWarningAmber } from 'react-icons/md';
import { usePopupSettings } from './usePopupSettings';
import type { Theme } from '../../theme/types';
import type { PopupView, RunPopupTask } from './types';

type PopupSettingsProps = {
    view: Pick<PopupView, 'instance' | 'permission'>;
    loading: boolean;
    theme: Theme;
    run: RunPopupTask;
    onSaved: () => void;
    onError: (message: string) => void;
};

export default function PopupSettings({
    view,
    loading,
    theme,
    run,
    onSaved,
    onError,
}: PopupSettingsProps) {
    const { savingTheme, saveSettings, saveTheme, enableWebsiteAccess } =
        usePopupSettings({ run, onSaved, onError });
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
            <label htmlFor="theme">Appearance</label>
            <select
                id="theme"
                name="theme"
                value={theme}
                disabled={loading || savingTheme}
                onChange={(event) =>
                    void saveTheme(event.target.value as Theme)
                }
            >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
            </select>
            <p className="muted">
                Follow your device or choose a light or dark theme. Changes save
                automatically.
            </p>
            <div className="settings-divider">
                <h3>Website access</h3>
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
