import { useState } from 'react';
import { messaging } from '../../messaging/rpc';
import { validateInstance } from '../../security/security';
import type { Theme } from '../../theme/types';
import type { RunPopupTask } from './types';

type UsePopupSettingsOptions = {
    run: RunPopupTask;
    onSaved: () => void;
    onError: (message: string) => void;
};

export function usePopupSettings({
    run,
    onSaved,
    onError,
}: UsePopupSettingsOptions) {
    const [savingTheme, setSavingTheme] = useState(false);

    const saveSettings = (data: FormData) =>
        run(async () => {
            const instance = String(data.get('instance'));
            validateInstance(instance, import.meta.env.DEV);
            const wasInstanceAccessDeclined =
                !(await chrome.permissions.request({
                    origins: [`${instance}/*`],
                }));
            if (wasInstanceAccessDeclined) {
                throw new Error('Instance host access was declined.');
            }
            await messaging.sendMessage('handleSettings', {
                instance,
                theme: data.get('theme') as Theme,
            });
            onSaved();
        });

    const saveTheme = async (theme: Theme) => {
        setSavingTheme(true);
        try {
            await messaging.sendMessage('setTheme', { theme });
        } catch (error) {
            onError(
                error instanceof Error
                    ? error.message
                    : 'Could not save appearance.'
            );
        } finally {
            setSavingTheme(false);
        }
    };

    const enableWebsiteAccess = () =>
        run(async () => {
            const wasWebsiteAccessDeclined = !(await chrome.permissions.request(
                {
                    origins: ['https://*/*'],
                }
            ));
            if (wasWebsiteAccessDeclined) {
                throw new Error(
                    'Website access was declined. Metadata and copy are still available.'
                );
            }
        });

    return { savingTheme, saveSettings, saveTheme, enableWebsiteAccess };
}
