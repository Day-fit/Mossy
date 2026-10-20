import { useState } from 'react';
import { rpc } from '../../messaging/rpc';
import { normalizeInstance } from '../../security/security';
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
            const instance = normalizeInstance(
                String(data.get('instance')),
                import.meta.env.DEV
            );
            if (
                !(await chrome.permissions.request({
                    origins: [`${instance}/*`],
                }))
            ) {
                throw new Error('Instance host access was declined.');
            }
            await rpc({ kind: 'settings', instance, theme: data.get('theme') });
            onSaved();
        });

    const saveTheme = async (theme: Theme) => {
        setSavingTheme(true);
        try {
            await rpc({ kind: 'theme', theme });
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
            if (
                !(await chrome.permissions.request({
                    origins: ['https://*/*'],
                }))
            ) {
                throw new Error(
                    'Website access was declined. Metadata and copy are still available.'
                );
            }
        });

    return { savingTheme, saveSettings, saveTheme, enableWebsiteAccess };
}
